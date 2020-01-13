import { Tile, MemLine, TileFeatureType, TileLine } from './types';
import { forEach } from '@toba/node-tools';

function eachPoint(line: TileLine, fn: (x: number, y: number) => void) {
   for (let i = 0; i < line.length; i += 2) {
      fn(line[i], line[i + 1]);
   }
}

/**
 * Transforms the coordinates of each feature in the given tile from
 * mercator-projected space into (extent x extent) tile space.
 */
export function transformTile(tile: Tile, extent: number): Tile {
   if (tile.transformed) {
      return tile;
   }

   const z2 = 1 << tile.z;
   const tx = tile.x;
   const ty = tile.y;

   forEach(tile.features, f => {
      const geom = f.geometry;
      const type = f.type;

      f.geometry = [];

      if (type === TileFeatureType.Point) {
         eachPoint(geom as TileLine, (x, y) => {
            (f.geometry as TileLine).push(
               ...transformPoint(x, y, extent, z2, tx, ty)
            );
         });
      } else {
         forEach(geom as TileLine[], line => {
            const ring: TileLine = [];
            eachPoint(line, (x: number, y: number) =>
               ring.push(...transformPoint(x, y, extent, z2, tx, ty))
            );
            (f.geometry as TileLine[]).push(ring);
         });
      }
   });

   tile.transformed = true;

   return tile;
}

function transformPoint(
   x: number,
   y: number,
   extent: number,
   z2: number,
   tx: number,
   ty: number
): [number, number] {
   return [
      Math.round(extent * (x * z2 - tx)),
      Math.round(extent * (y * z2 - ty))
   ];
}
