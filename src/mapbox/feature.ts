import { GeoJsonType as Type } from '@toba/map';
import { MemFeature, MemLine, MemPolygon, MemGeometry } from './types';
import { GeoJsonProperties, GeoJsonTypes } from 'geojson';
import { forEach } from '@toba/node-tools';

export function createFeature(
   id: string | number | undefined,
   type: GeoJsonTypes,
   geom: MemGeometry,
   tags: GeoJsonProperties
) {
   const feature: MemFeature = {
      id, //id: id == null ? null : id,
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

function calcBBox(feature: MemFeature) {
   const geom = feature.geometry;
   const type = feature.type;

   switch (type) {
      case Type.Point:
      case Type.MultiPoint:
      case Type.Line:
         calcLineBBox(feature, geom as MemLine);
         break;
      case Type.Polygon:
         // the outer ring (ie [0]) contains all inner rings
         calcLineBBox(feature, (geom as MemPolygon)[0]);
         break;
      case Type.MultiLine:
         forEach(geom as MemLine[], line => calcLineBBox(feature, line));
         break;
      case Type.MultiPolygon:
         forEach(geom as MemPolygon[], p => {
            // the outer ring (ie [0]) contains all inner rings
            calcLineBBox(feature, p[0]);
         });
         break;
   }
}

function calcLineBBox(feature: MemFeature, line: MemLine) {
   for (let i = 0; i < line.length; i += 3) {
      feature.minX = Math.min(feature.minX, line[i]);
      feature.minY = Math.min(feature.minY, line[i + 1]);
      feature.maxX = Math.max(feature.maxX, line[i]);
      feature.maxY = Math.max(feature.maxY, line[i + 1]);
   }
}
