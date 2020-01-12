import { Tile, Point, VectorGeometry } from './types';

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

   for (const feature of tile.features) {
      const geom = feature.geometry;
      const type = feature.type;

      feature.geometry = [];

      if (type === 1) {
         for (let j = 0; j < geom.length; j += 2) {
            feature.geometry.push(
               transformPoint(geom[j], geom[j + 1], extent, z2, tx, ty)
            );
         }
      } else {
         for (let j = 0; j < geom.length; j++) {
            const ring: VectorGeometry = [];
            for (let k = 0; k < geom[j].length; k += 2) {
               ring.push(
                  transformPoint(geom[j][k], geom[j][k + 1], extent, z2, tx, ty)
               );
            }
            feature.geometry.push(ring);
         }
      }
   }

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
): Point {
   return [
      Math.round(extent * (x * z2 - tx)),
      Math.round(extent * (y * z2 - ty))
   ];
}
