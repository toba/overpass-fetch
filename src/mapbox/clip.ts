import { GeoJsonType as Type } from '@toba/map';
import { forEach } from '@toba/node-tools';
import { createFeature } from './feature';
import {
   MemFeature,
   Options,
   Axis,
   MemGeometry,
   MemLine,
   MemPolygon
} from './types';

/**
 * Stripe clipping algorithm. Clip features between two vertical or horizontal
 * axis-parallel lines:
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 *
 * @param k1 Lower axis boundary
 * @param k2 Upper axis boundary
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
   options: Partial<Options>
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

   const clipped: MemFeature[] = [];

   forEach(features, f => {
      /** Original geometry */
      const from = f.geometry;
      const min = axis === Axis.Horizontal ? f.minX : f.minY;
      const max = axis === Axis.Horizontal ? f.maxX : f.maxY;

      let type = f.type;

      if (min >= k1 && max < k2) {
         // trivial accept
         clipped.push(f);
         return;
      } else if (max < k1 || min >= k2) {
         // trivial reject
         return;
      }

      /** Clipped geometry */
      let to: MemGeometry = [];

      switch (type) {
         case Type.Point:
         case Type.MultiPoint:
            clipPoints(from as MemLine, to as MemLine, k1, k2, axis);
            break;
         case Type.Line:
            clipLine(
               from as MemLine,
               to as MemLine[],
               k1,
               k2,
               axis,
               false,
               options.lineMetrics ?? false
            );
            break;
         case Type.Polygon:
         case Type.MultiLine:
            clipLines(
               from as MemLine[],
               to as MemLine[],
               k1,
               k2,
               axis,
               type == Type.Polygon
            );
            break;
         case Type.MultiPolygon:
            forEach(from as MemPolygon[], p => {
               const newPolygon: MemPolygon = [];
               clipLines(p, newPolygon, k1, k2, axis, true);
               if (newPolygon.length) {
                  (to as MemPolygon[]).push(newPolygon);
               }
            });
            break;
      }

      if (to.length) {
         if (options.lineMetrics && type === Type.Line) {
            for (const line of to as MemLine[]) {
               // to is line array for `Type.Line` because original line may
               // be sliced into multiple
               clipped.push(createFeature(f.id, type, line, f.tags));
            }
            return;
         }

         if (type === Type.Line || type === Type.MultiLine) {
            if (to.length === 1) {
               type = Type.Line;
               to = (to as MemLine[])[0];
            } else {
               type = Type.MultiLine;
            }
         }

         if (type === Type.Point || type === Type.MultiPoint) {
            type = to.length === 3 ? Type.Point : Type.MultiPoint;
         }

         clipped.push(createFeature(f.id, type, to, f.tags));
      }
   });

   return clipped.length ? clipped : null;
}

function clipPoints(
   points: MemLine,
   newPoints: MemLine,
   k1: number,
   k2: number,
   axis: Axis
) {
   for (let i = 0; i < points.length; i += 3) {
      const a = points[i + axis];

      if (a >= k1 && a <= k2) {
         addPoint(newPoints, points[i], points[i + 1], points[i + 2]);
      }
   }
}

/**
 * @param newLine Array of lines since original `line` may be sliced to fit
 * boundaries
 * @param k1 Lower axis boundary
 * @param k2 Upper axis boundary
 */
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
      /** Axis coordinate for point `a` */
      const a = axis === Axis.Horizontal ? ax : ay;
      /** Axis coordinate for point `b` */
      const b = axis === Axis.Horizontal ? bx : by;
      /** Whether line exits the clip area */
      let exited = false;

      if (trackMetrics) {
         segLen = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));
      }

      if (a < k1) {
         // ——|-->  | (line enters the clip region from the left)
         if (b > k1) {
            t = intersect(slice, ax, ay, bx, by, k1);
            if (trackMetrics) {
               slice.start = len + segLen * t;
            }
         }
      } else if (a > k2) {
         // |  <--|—— (line enters the clip region from the right)
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
         // <--|——  | or <--|———|—— (line exits the clip region on the left)
         t = intersect(slice, ax, ay, bx, by, k1);
         exited = true;
      }
      if (b > k2 && a <= k2) {
         // |  ——|--> or ——|———|--> (line exits the clip region on the right)
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

/**
 * @param z Zoom
 */
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
): number {
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
): number {
   const t = (y - ay) / (by - ay);
   addPoint(out, ax + (bx - ax) * t, y, 1);
   return t;
}
