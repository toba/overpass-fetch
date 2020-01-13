import { GeoJsonType as Type } from '@toba/map';
import { clip } from './clip';
import { createFeature } from './feature';
import { Options, MemFeature, MemLine, MemGeometry, MemPolygon } from './types';
import { forEach } from '@toba/node-tools';

/**
 * Date line processing
 */
export function wrap(features: MemFeature[], options: Options): MemFeature[] {
   const buffer = options.buffer / options.extent;
   /** Center world copy */
   let merged = features;
   /** Left world copy */
   const left = clip(features, 1, -1 - buffer, buffer, 0, -1, 2, options);
   /** Right world copy */
   const right = clip(features, 1, 1 - buffer, 2 + buffer, 0, -1, 2, options);

   if (left || right) {
      merged = clip(features, 1, -buffer, 1 + buffer, 0, -1, 2, options) || [];

      if (left) {
         // merge left into center
         merged = shiftFeatureCoords(left, 1).concat(merged);
      }
      if (right) {
         // merge right into center
         merged = merged.concat(shiftFeatureCoords(right, -1));
      }
   }

   return merged;
}

function shiftFeatureCoords(features: MemFeature[], offset: number) {
   const newFeatures: MemFeature[] = [];

   forEach(features, f => {
      const type = f.type;

      let newGeometry: MemGeometry;

      switch (type) {
         case Type.Point:
         case Type.MultiPoint:
         case Type.Line:
            newGeometry = shiftCoords(f.geometry as MemLine, offset);
            break;
         case Type.MultiLine:
         case Type.Polygon:
            newGeometry = (f.geometry as MemPolygon).map(line =>
               shiftCoords(line, offset)
            );
            break;
         case Type.MultiPolygon:
            newGeometry = (f.geometry as MemPolygon[]).map(p =>
               p.map(line => shiftCoords(line, offset))
            );
            break;
         default:
            newGeometry = [];
      }

      newFeatures.push(createFeature(f.id, type, newGeometry, f.tags));
   });

   return newFeatures;
}

function shiftCoords(points: MemLine, offset: number): MemLine {
   const newPoints: MemLine = [];
   newPoints.size = points.size;

   if (points.start !== undefined) {
      newPoints.start = points.start;
      newPoints.end = points.end;
   }

   for (let i = 0; i < points.length; i += 3) {
      newPoints.push(points[i] + offset, points[i + 1], points[i + 2]);
   }
   return newPoints;
}
