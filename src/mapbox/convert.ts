import { GeoJsonType as Type } from '@toba/map';
import { simplify } from './simplify';
import { createFeature } from './feature';
import { Options, VectorFeature, List } from './types';
import {
   GeoJSON,
   Point,
   FeatureCollection,
   Feature,
   Geometry,
   Position,
   GeometryCollection,
   MultiPoint,
   LineString,
   MultiLineString,
   Polygon,
   MultiPolygon
} from 'geojson';

/**
 * Converts GeoJSON feature into an intermediate projected JSON vector format
 * with simplification data.
 */
export function convert(data: GeoJSON, options: Options) {
   const features: VectorFeature[] = [];

   if (data.type === Type.FeatureCollection) {
      const collection = data as FeatureCollection;

      for (let i = 0; i < collection.features.length; i++) {
         convertFeature(features, data.features[i], options, i);
      }
   } else if (data.type === Type.Feature) {
      convertFeature(features, data as Feature, options);
   } else {
      // single geometry or a geometry collection
      convertFeature(
         features,
         { geometry: data as Geometry } as Feature,
         options
      );
   }

   return features;
}

function convertFeature(
   features: VectorFeature[],
   geojson: Feature,
   options: Options,
   index?: number
) {
   if (!geojson.geometry) {
      return;
   }
   const type = geojson.geometry.type;
   const tolerance = Math.pow(
      options.tolerance / ((1 << options.maxZoom) * options.extent),
      2
   );
   let geometry: number[] | number[][] = [];
   let id = geojson.id;

   if (options.promoteId) {
      id = geojson.properties?.[options.promoteId];
   } else if (options.generateId) {
      id = index ?? 0;
   }

   switch (type) {
      case Type.Point: {
         const point = geojson.geometry as Point;
         convertPoint(point.coordinates, geometry);
         break;
      }
      case Type.MultiPoint: {
         const points = geojson.geometry as MultiPoint;
         for (const p of points.coordinates) {
            convertPoint(p, geometry);
         }
         break;
      }
      case Type.Line: {
         const line = geojson.geometry as LineString;
         convertLine(line.coordinates, geometry, tolerance, false);
         break;
      }
      case Type.MultiLine: {
         const lines = geojson.geometry as MultiLineString;
         if (options.lineMetrics) {
            // explode into linestrings to be able to track metrics
            for (const line of lines.coordinates) {
               geometry = [];
               convertLine(line, geometry, tolerance, false);
               features.push(
                  createFeature(id, Type.Line, geometry, geojson.properties)
               );
            }
            return;
         } else {
            convertLines(lines.coordinates, geometry, tolerance, false);
         }
         break;
      }
      case Type.Polygon: {
         const poly = geojson.geometry as Polygon;
         convertLines(poly.coordinates, geometry, tolerance, true);
         break;
      }
      case Type.MultiPolygon: {
         const multi = geojson.geometry as MultiPolygon;
         for (const polygon of multi) {
            const newPolygon: number[] = [];
            convertLines(polygon, newPolygon, tolerance, true);
            geometry.push(newPolygon);
         }
         break;
      }
      case Type.GeometryCollection: {
         const multi = geojson.geometry as GeometryCollection;
         for (const singleGeometry of multi.geometries) {
            convertFeature(
               features,
               {
                  id,
                  type: Type.Feature,
                  geometry: singleGeometry,
                  properties: geojson.properties
               },
               options,
               index
            );
         }
         return;
      }
      default:
         throw new Error('Input data is not a valid GeoJSON object');
   }

   features.push(createFeature(id, type, geometry, geojson.properties));
}

function convertPoint(coords: Position, out: number[]) {
   out.push(projectX(coords[0]), projectY(coords[1]), 0);
}

function convertLine(
   ring: Position[],
   out: List<number>,
   tolerance: number,
   isPolygon: boolean
) {
   let x0 = 0;
   let y0 = 0;
   let size = 0;

   for (let j = 0; j < ring.length; j++) {
      const x = projectX(ring[j][0]);
      const y = projectY(ring[j][1]);

      out.push(x, y, 0);

      if (j > 0) {
         if (isPolygon) {
            size += (x0 * y - x * y0) / 2; // area
         } else {
            size += Math.sqrt(Math.pow(x - x0, 2) + Math.pow(y - y0, 2)); // length
         }
      }
      x0 = x;
      y0 = y;
   }

   const last = out.length - 3;
   out[2] = 1;
   simplify(out, 0, last, tolerance);
   out[last + 2] = 1;

   out.size = Math.abs(size);
   out.start = 0;
   out.end = out.size;
}

function convertLines(
   rings: Position[][],
   out: number[][],
   tolerance: number,
   isPolygon: boolean
) {
   for (let i = 0; i < rings.length; i++) {
      const geom: number[] = [];
      convertLine(rings[i], geom, tolerance, isPolygon);
      out.push(geom);
   }
}

function projectX(x: number): number {
   return x / 360 + 0.5;
}

function projectY(y: number): number {
   const sin = Math.sin((y * Math.PI) / 180);
   const y2 = 0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI;
   return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}
