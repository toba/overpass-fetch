import { GeoJsonType as Type } from '@toba/map';
import { clip } from './clip';
import { createFeature } from './feature';
import { Options, VectorFeature, Point, VectorGeometry } from './types';

/**
 * Date line processing
 */
export function wrap(features: VectorFeature[], options: Options) {
   const buffer = options.buffer / options.extent;
   let merged = features;

   const left = clip(features, 1, -1 - buffer, buffer, 0, -1, 2, options); // left world copy
   const right = clip(features, 1, 1 - buffer, 2 + buffer, 0, -1, 2, options); // right world copy

   if (left || right) {
      merged = clip(features, 1, -buffer, 1 + buffer, 0, -1, 2, options) || []; // center world copy

      if (left) merged = shiftFeatureCoords(left, 1).concat(merged); // merge left into center
      if (right) merged = merged.concat(shiftFeatureCoords(right, -1)); // merge right into center
   }

   return merged;
}

function shiftFeatureCoords(features: VectorFeature[], offset: number) {
   const newFeatures = [];

   for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const type = feature.type;

      let newGeometry;

      if (
         type === Type.Point ||
         type === Type.MultiPoint ||
         type === Type.Line
      ) {
         newGeometry = shiftCoords(feature.geometry, offset);
      } else if (type === Type.MultiLine || type === Type.Polygon) {
         newGeometry = [];
         for (const line of feature.geometry) {
            newGeometry.push(shiftCoords(line, offset));
         }
      } else if (type === Type.MultiPolygon) {
         newGeometry = [];
         for (const polygon of feature.geometry) {
            const newPolygon = [];
            for (const line of polygon) {
               newPolygon.push(shiftCoords(line, offset));
            }
            newGeometry.push(newPolygon);
         }
      }

      newFeatures.push(
         createFeature(feature.id, type, newGeometry, feature.tags)
      );
   }

   return newFeatures;
}

function shiftCoords(points: VectorGeometry, offset: number) {
   const newPoints: VectorGeometry = [];
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
