import { GeoJsonType as Type } from '@toba/map';
import { createFeature } from './feature';
import {
   MemFeature,
   Options,
   Axis,
   MemGeometry,
   MemLine,
   MemPolygon
} from './types';
import { forEach } from '@toba/node-tools';

/**
 * Stripe clipping algorithm. Clip features between two vertical or horizontal
 * axis-parallel lines:
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 *
 * k1 and k2 are the line coordinates
 * @param minAll Minimum coordinate for all features
 * @param maxall Maximum coordinate for all features
 */
export function clip(
   features: MemFeature[],
   scale: number,
   k1: number,
   k2: number,
   axis: Axis,
   minAll: number,
   maxAll: number,
   options: Options
): MemFeature[] | null {
   k1 /= scale;
   k2 /= scale;

   if (minAll >= k1 && maxAll < k2) {
      // all features within bounds — trivial accept
      return features;
   } else if (maxAll < k1 || minAll >= k2) {
      // all features outside bounds — trivial reject
      return null;
   }

   const clipped = [];

   for (const feature of features) {
      const geometry = feature.geometry;
      let type = feature.type;

      const min = axis === 0 ? feature.minX : feature.minY;
      const max = axis === 0 ? feature.maxX : feature.maxY;

      if (min >= k1 && max < k2) {
         // trivial accept
         clipped.push(feature);
         continue;
      } else if (max < k1 || min >= k2) {
         // trivial reject
         continue;
      }

      let newGeometry: MemGeometry = [];

      switch (type) {
         case Type.Point:
         case Type.MultiPoint:
            clipPoints(
               geometry as MemLine,
               newGeometry as MemLine,
               k1,
               k2,
               axis
            );
            break;
         case Type.Line:
            clipLine(
               geometry as MemLine,
               newGeometry as MemLine[],
               k1,
               k2,
               axis,
               false,
               options.lineMetrics
            );
            break;
         case Type.Polygon:
         case Type.MultiLine:
            clipLines(
               geometry as MemLine[],
               newGeometry as MemLine[],
               k1,
               k2,
               axis,
               type == Type.Polygon
            );
            break;
         case Type.MultiPolygon:
            forEach(geometry as MemPolygon[], p => {
               const newPolygon: MemPolygon = [];
               clipLines(p, newPolygon, k1, k2, axis, true);
               if (newPolygon.length) {
                  (newGeometry as MemPolygon[]).push(newPolygon);
               }
            });
            break;
      }

      if (newGeometry.length) {
         // TODO: verity the type comparison
         if (options.lineMetrics && type === Type.MultiLine) {
            for (const line of newGeometry as MemLine[]) {
               clipped.push(
                  createFeature(feature.id, type, line, feature.tags)
               );
            }
            // TODO: what is this doing?
            continue;
         }

         if (type === Type.Line || type === Type.MultiLine) {
            if (newGeometry.length === 1) {
               type = Type.Line;
               newGeometry = (newGeometry as MemLine[])[0];
            } else {
               type = Type.MultiLine;
            }
         }
         if (type === Type.Point || type === Type.MultiPoint) {
            type = newGeometry.length === 3 ? Type.Point : Type.MultiPoint;
         }

         clipped.push(
            createFeature(feature.id, type, newGeometry, feature.tags)
         );
      }
   }

   return clipped.length ? clipped : null;
}

function clipPoints(
   geom: MemLine,
   newGeom: MemLine,
   k1: number,
   k2: number,
   axis: Axis
) {
   for (let i = 0; i < geom.length; i += 3) {
      const a = geom[i + axis];

      if (a >= k1 && a <= k2) {
         addPoint(newGeom, geom[i], geom[i + 1], geom[i + 2]);
      }
   }
}

function clipLine(
   line: MemLine,
   newLine: MemLine[],
   k1: number,
   k2: number,
   axis: Axis,
   isPolygon: boolean,
   trackMetrics: boolean
) {
   let slice = newSlice(line);
   const intersect = axis === Axis.Horizontal ? intersectX : intersectY;
   let len = line.start ?? 0;
   let segLen = 0;
   let t = 0;

   for (let i = 0; i < line.length - 3; i += 3) {
      const ax = line[i];
      const ay = line[i + 1];
      const az = line[i + 2];
      const bx = line[i + 3];
      const by = line[i + 4];
      const a = axis === Axis.Horizontal ? ax : ay;
      const b = axis === Axis.Horizontal ? bx : by;
      /** Whether line exits the clip area */
      let exited = false;

      if (trackMetrics) {
         segLen = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
      }

      if (a < k1) {
         // ---|-->  | (line enters the clip region from the left)
         if (b > k1) {
            t = intersect(slice, ax, ay, bx, by, k1);
            if (trackMetrics) {
               slice.start = len + segLen * t;
            }
         }
      } else if (a > k2) {
         // |  <--|--- (line enters the clip region from the right)
         if (b < k2) {
            t = intersect(slice, ax, ay, bx, by, k2);
            if (trackMetrics) {
               slice.start = len + segLen * t;
            }
         }
      } else {
         addPoint(slice, ax, ay, az);
      }
      if (b < k1 && a >= k1) {
         // <--|---  | or <--|-----|--- (line exits the clip region on the left)
         t = intersect(slice, ax, ay, bx, by, k1);
         exited = true;
      }
      if (b > k2 && a <= k2) {
         // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
         t = intersect(slice, ax, ay, bx, by, k2);
         exited = true;
      }

      if (!isPolygon && exited) {
         if (trackMetrics) {
            slice.end = len + segLen * t;
         }
         newLine.push(slice);
         slice = newSlice(line);
      }

      if (trackMetrics) {
         len += segLen;
      }
   }

   // add the last point
   let last = line.length - 3;
   const ax = line[last];
   const ay = line[last + 1];
   const az = line[last + 2];
   const a = axis === 0 ? ax : ay;

   if (a >= k1 && a <= k2) {
      addPoint(slice, ax, ay, az);
   }

   // close the polygon if its endpoints are not the same after clipping
   last = slice.length - 3;
   if (
      isPolygon &&
      last >= 3 &&
      (slice[last] !== slice[0] || slice[last + 1] !== slice[1])
   ) {
      addPoint(slice, slice[0], slice[1], slice[2]);
   }

   // add the final slice
   if (slice.length) {
      // TODO: how is line pushing to line?
      newLine.push(slice);
   }
}

function newSlice(line: MemLine) {
   const slice: MemLine = [];
   slice.size = line.size;
   slice.start = line.start;
   slice.end = line.end;
   return slice;
}

function clipLines(
   lines: MemLine[],
   newLines: MemLine[],
   k1: number,
   k2: number,
   axis: Axis,
   isPolygon: boolean
) {
   forEach(lines, line => {
      clipLine(line, newLines, k1, k2, axis, isPolygon, false);
   });
}

function addPoint(out: MemLine, x: number, y: number, z: number) {
   out.push(x, y, z);
}

function intersectX(
   out: number[],
   ax: number,
   ay: number,
   bx: number,
   by: number,
   x: number
) {
   const t = (x - ax) / (bx - ax);
   addPoint(out, x, ay + (by - ay) * t, 1);
   return t;
}

function intersectY(
   out: number[],
   ax: number,
   ay: number,
   bx: number,
   by: number,
   y: number
) {
   const t = (y - ay) / (by - ay);
   addPoint(out, ax + (bx - ax) * t, y, 1);
   return t;
}
