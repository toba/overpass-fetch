import { GeoJSON } from 'geojson';
import { convert } from './convert';
import { clip } from './clip';
import { wrap } from './wrap';
import { transformTile as transform } from './transform';
import { createTile } from './tile';
import { Options, Tile, LogLevel, Coordinate, MemFeature } from './types';

export default function geojsonvt(data: GeoJSON, options: Options) {
   return new GeoJSONVT(data, options);
}

const defaultOptions: Options = {
   maxZoom: 14,
   indexMaxZoom: 5,
   indexMaxPoints: 100000,
   tolerance: 3,
   extent: 4096,
   buffer: 64,
   lineMetrics: false,
   generateID: false,
   debug: LogLevel.None
};

class GeoJSONVT {
   options: Options = Object.create(defaultOptions);
   tiles: { [key: string]: Tile };
   tileCoords: Coordinate[];
   total: number;
   stats: { [key: string]: number };

   constructor(data: GeoJSON, options: Options) {
      extend(this.options, options);

      const debug = this.options.debug;

      if (debug > LogLevel.None) {
         console.time('preprocess data');
      }
      if (options.maxZoom < 0 || options.maxZoom > 24) {
         throw new Error('maxZoom should be in the 0-24 range');
      }
      if (options.promoteID && options.generateID) {
         throw new Error('promoteId and generateId cannot be used together.');
      }

      // projects and adds simplification info
      let features = convert(data, options);

      // tiles and tileCoords are part of the public API
      this.tiles = {};
      this.tileCoords = [];

      if (debug > LogLevel.None) {
         console.timeEnd('preprocess data');
         console.log(
            'index: maxZoom: %d, maxPoints: %d',
            options.indexMaxZoom,
            options.indexMaxPoints
         );
         console.time('generate tiles');

         this.stats = {};
         this.total = 0;
      }

      // wraps features (ie extreme west and extreme east)
      features = wrap(features, options);

      // start slicing from the top tile down
      if (features.length) {
         this.splitTile(features, 0, 0, 0);
      }

      if (debug) {
         if (features.length)
            console.log(
               'features: %d, points: %d',
               this.tiles[0].numFeatures,
               this.tiles[0].numPoints
            );
         console.timeEnd('generate tiles');
         console.log(
            'tiles generated:',
            this.total,
            JSON.stringify(this.stats)
         );
      }
   }

   /**
    * Splits features from a parent tile to sub-tiles.
    * `z`, `x`, and `y` are the coordinates of the parent tile;
    *
    * If no target tile is specified, splitting stops when we reach the maximum
    * zoom or the number of points is low as specified in the options.
    *
    * @param cz Target tile `z` coordinate
    * @param cx Target tile `x` coordinate
    * @param cy Target tile `y` coordinate
    */
   splitTile(
      features: MemFeature[] | null,
      z: number,
      x: number,
      y: number,
      cz?: number,
      cx?: number,
      cy?: number
   ) {
      const stack = [features, z, x, y];
      const options = this.options;
      const debug = options.debug;

      // avoid recursion by using a processing queue
      while (stack.length > 0) {
         y = stack.pop() as number;
         x = stack.pop() as number;
         z = stack.pop() as number;
         features = stack.pop() as MemFeature[];

         const z2 = 1 << z;
         const id = toID(z, x, y);
         let tile = this.tiles[id];

         if (!tile) {
            if (debug > LogLevel.Basic) {
               console.time('creation');
            }

            tile = this.tiles[id] = createTile(features, z, x, y, options);
            this.tileCoords.push({ z, x, y });

            if (debug > LogLevel.None) {
               if (debug > LogLevel.Basic) {
                  console.log(
                     'tile z%d-%d-%d (features: %d, points: %d, simplified: %d)',
                     z,
                     x,
                     y,
                     tile.numFeatures,
                     tile.numPoints,
                     tile.numSimplified
                  );
                  console.timeEnd('creation');
               }
               const key = `z${z}`;
               this.stats[key] = (this.stats[key] || 0) + 1;
               this.total++;
            }
         }

         // save reference to original geometry in tile so that we can drill down later if we stop now
         tile.source = features;

         // if it's the first-pass tiling
         if (cz === undefined) {
            // stop tiling if we reached max zoom, or if the tile is too simple
            if (
               z === options.indexMaxZoom ||
               tile.numPoints <= options.indexMaxPoints
            ) {
               continue;
            }
            // if a drilldown to a specific tile
         } else if (z === options.maxZoom || z === cz) {
            // stop tiling if we reached base zoom or our target tile zoom
            continue;
         } else if (cz !== undefined && cx !== undefined && cy !== undefined) {
            // stop tiling if it's not an ancestor of the target tile
            const zoomSteps = cz - z;
            if (x !== cx >> zoomSteps || y !== cy >> zoomSteps) {
               continue;
            }
         }

         // if we slice further down, no need to keep source geometry
         tile.source = undefined;

         if (features.length === 0) {
            continue;
         }

         if (debug > LogLevel.Basic) {
            console.time('clipping');
         }

         // values we'll use for clipping
         const k1 = (0.5 * options.buffer) / options.extent;
         const k2 = 0.5 - k1;
         const k3 = 0.5 + k1;
         const k4 = 1 + k1;

         /** Top left */
         let tl = null;
         /** Bottom left */
         let bl = null;
         /** Top right */
         let tr = null;
         /** Bottom right */
         let br = null;

         let left = clip(
            features,
            z2,
            x - k1,
            x + k3,
            0,
            tile.minX,
            tile.maxX,
            options
         );
         let right = clip(
            features,
            z2,
            x + k2,
            x + k4,
            0,
            tile.minX,
            tile.maxX,
            options
         );
         features = null;

         if (left !== null) {
            tl = clip(
               left,
               z2,
               y - k1,
               y + k3,
               1,
               tile.minY,
               tile.maxY,
               options
            );
            bl = clip(
               left,
               z2,
               y + k2,
               y + k4,
               1,
               tile.minY,
               tile.maxY,
               options
            );
            left = null;
         }

         if (right !== null) {
            tr = clip(
               right,
               z2,
               y - k1,
               y + k3,
               1,
               tile.minY,
               tile.maxY,
               options
            );
            br = clip(
               right,
               z2,
               y + k2,
               y + k4,
               1,
               tile.minY,
               tile.maxY,
               options
            );
            right = null;
         }

         if (debug > LogLevel.Basic) {
            console.timeEnd('clipping');
         }

         stack.push(tl || [], z + 1, x * 2, y * 2);
         stack.push(bl || [], z + 1, x * 2, y * 2 + 1);
         stack.push(tr || [], z + 1, x * 2 + 1, y * 2);
         stack.push(br || [], z + 1, x * 2 + 1, y * 2 + 1);
      }
   }

   getTile(z: number, x: number, y: number): Tile | null {
      z = +z;
      x = +x;
      y = +y;

      const options = this.options;
      const { extent, debug } = options;

      if (z < 0 || z > 24) {
         return null;
      }

      const z2 = 1 << z;
      x = (x + z2) & (z2 - 1); // wrap tile x coordinate

      const id = toID(z, x, y);
      if (this.tiles[id]) {
         return transform(this.tiles[id], extent);
      }

      if (debug > LogLevel.Basic) {
         console.log('drilling down to z%d-%d-%d', z, x, y);
      }

      let z0 = z;
      let x0 = x;
      let y0 = y;
      let parent;

      while (!parent && z0 > 0) {
         z0--;
         x0 = x0 >> 1;
         y0 = y0 >> 1;
         parent = this.tiles[toID(z0, x0, y0)];
      }

      if (!parent || !parent.source) {
         return null;
      }

      // if we found a parent tile containing the original geometry, we can drill down from it
      if (debug > LogLevel.Basic) {
         console.log('found parent tile z%d-%d-%d', z0, x0, y0);
         console.time('drilling down');
      }
      this.splitTile(parent.source, z0, x0, y0, z, x, y);

      if (debug > LogLevel.Basic) {
         console.timeEnd('drilling down');
      }

      return this.tiles[id] ? transform(this.tiles[id], extent) : null;
   }
}

/**
 * Create a unique ID based on tile coordinate.
 */
const toID = (z: number, x: number, y: number) => ((1 << z) * y + x) * 32 + z;

/**
 * Copy all values, without regard for `null` or `undefined`, from `src` to
 * `dest` and return `dest`.
 */
function extend<T extends Object>(dest: T, src: T): T {
   for (const i in src) {
      dest[i] = src[i];
   }
   return dest;
}
