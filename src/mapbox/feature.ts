import { GeoJsonType as Type } from '@toba/map';
import { VectorFeature } from './types';
import { GeoJsonProperties, GeoJsonTypes } from 'geojson';

export function createFeature(
   id: string | number | undefined,
   type: GeoJsonTypes,
   geom: number[][],
   tags: GeoJsonProperties
) {
   const feature: VectorFeature = {
      id: id == null ? null : id,
      type,
      geometry: geom,
      tags,
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
   };
   calcBBox(feature);

   return feature;
}

function calcBBox(feature: VectorFeature) {
   const geom = feature.geometry;
   const type = feature.type;

   switch (type) {
      case Type.Point:
      case Type.MultiPoint:
      case Type.Line:
         calcLineBBox(feature, geom);
         break;
      case Type.Polygon:
         // the outer ring (ie [0]) contains all inner rings
         calcLineBBox(feature, geom[0]);
         break;
      case Type.MultiLine:
         for (const line of geom) {
            calcLineBBox(feature, line);
         }
         break;
      case Type.MultiPolygon:
         for (const polygon of geom) {
            // the outer ring (ie [0]) contains all inner rings
            calcLineBBox(feature, polygon[0]);
         }
         break;
   }

   // if (type === Type.Point || type === Type.MultiPoint || type === Type.Line) {
   //    calcLineBBox(feature, geom);
   // } else if (type === Type.Polygon) {
   //    // the outer ring (ie [0]) contains all inner rings
   //    calcLineBBox(feature, geom[0]);
   // } else if (type === Type.MultiLine) {
   //    for (const line of geom) {
   //       calcLineBBox(feature, line);
   //    }
   // } else if (type === Type.MultiPolygon) {
   //    for (const polygon of geom) {
   //       // the outer ring (ie [0]) contains all inner rings
   //       calcLineBBox(feature, polygon[0]);
   //    }
   // }
}

function calcLineBBox(feature: VectorFeature, geom: number[]) {
   for (let i = 0; i < geom.length; i += 3) {
      feature.minX = Math.min(feature.minX, geom[i]);
      feature.minY = Math.min(feature.minY, geom[i + 1]);
      feature.maxX = Math.max(feature.maxX, geom[i]);
      feature.maxY = Math.max(feature.maxY, geom[i + 1]);
   }
}
