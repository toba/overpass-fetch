import { forEach } from '@toba/node-tools';
import { GeoJsonType as Type } from '@toba/map';
import { simplify } from './simplify';
import { createFeature } from './feature';
import {
   Options,
   MemFeature,
   MemLine,
   MemPoint,
   MemPolygon,
   MemGeometry
} from './types';
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
export function convert(data: GeoJSON, options: Options): MemFeature[] {
   const features: MemFeature[] = [];

   if (data.type === Type.FeatureCollection) {
      const collection = data as FeatureCollection;

      forEach(collection.features, (f, i) => {
         convertFeature(features, f, options, i);
      });
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

/**
 * Convert `geojson` `Feature` to a `VectorFeature` and add to `features` list.
 */
function convertFeature(
   features: MemFeature[],
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
   let geometry: MemGeometry = [];
   let id = geojson.id;

   if (options.promoteID) {
      id = geojson.properties?.[options.promoteID];
   } else if (options.generateID) {
      id = index ?? 0;
   }

   switch (type) {
      case Type.Point: {
         const point = geojson.geometry as Point;
         convertPoint(point.coordinates, geometry as MemLine);
         break;
      }
      case Type.MultiPoint: {
         const points = geojson.geometry as MultiPoint;
         for (const p of points.coordinates) {
            convertPoint(p, geometry as MemLine);
         }
         break;
      }
      case Type.Line: {
         const line = geojson.geometry as LineString;
         convertLine(line.coordinates, geometry as MemLine, tolerance, false);
         break;
      }
      case Type.MultiLine: {
         const lines = geojson.geometry as MultiLineString;
         if (options.lineMetrics) {
            // explode into linestrings to be able to track metrics
            for (const line of lines.coordinates) {
               geometry = [] as MemLine;
               convertLine(line, geometry, tolerance, false);
               features.push(
                  createFeature(id, Type.Line, geometry, geojson.properties)
               );
            }
            return;
         } else {
            convertLines(
               lines.coordinates,
               geometry as MemLine[],
               tolerance,
               false
            );
         }
         break;
      }
      case Type.Polygon: {
         const poly = geojson.geometry as Polygon;
         convertLines(
            poly.coordinates,
            geometry as MemPolygon,
            tolerance,
            true
         );
         break;
      }
      case Type.MultiPolygon: {
         const multi = geojson.geometry as MultiPolygon;
         forEach(multi.coordinates, p => {
            const polygon: MemPolygon = [];
            convertLines(p, polygon, tolerance, true);
            (geometry as MemPolygon[]).push(polygon);
         });
         break;
      }
      case Type.GeometryCollection: {
         const multi = geojson.geometry as GeometryCollection;
         forEach(multi.geometries, g => {
            convertFeature(
               features,
               {
                  id,
                  type: Type.Feature,
                  geometry: g,
                  properties: geojson.properties
               },
               options,
               index
            );
         });
         return;
      }
      default:
         throw new Error('Input data is not a valid GeoJSON object');
   }

   features.push(createFeature(id, type, geometry, geojson.properties));
}

function convertPoint(coords: Position, out: MemLine) {
   out.push(projectX(coords[0]), projectY(coords[1]), 0);
}

/**
 * @param isPolygon Whether line is closed (start and end connect)
 */
function convertLine(
   line: Position[],
   out: MemLine,
   tolerance: number,
   isPolygon: boolean
) {
   /** Last `x` coordinate */
   let x0 = 0;
   /** Last `y` coordinate */
   let y0 = 0;
   /** Length of line or area of polygon */
   let size = 0;

   forEach(line, (point, i) => {
      const x = projectX(point[0]);
      const y = projectY(point[1]);

      out.push(x, y, 0);

      if (i > 0) {
         size += isPolygon
            ? // area
              (x0 * y - x * y0) / 2
            : // length
              Math.sqrt((x - x0) ** 2 + (y - y0) ** 2);
      }
      x0 = x;
      y0 = y;
   });

   const last = out.length - 3;
   out[2] = 1;
   simplify(out, 0, last, tolerance);
   out[last + 2] = 1;

   out.size = Math.abs(size);
   out.start = 0;
   out.end = out.size;
}

/**
 * Multiple lines or polygons imply a feature described with concentric polygons
 * or "rings" that may be wound one way or the other to indicate addition or
 * substraction from the containing polygon.
 */
function convertLines(
   rings: Position[][],
   out: MemLine[],
   tolerance: number,
   isPolygon: boolean
) {
   forEach(rings, r => {
      const line: MemLine = [];
      convertLine(r, line, tolerance, isPolygon);
      out.push(line);
   });
}

/**
 * Translate from WSG84 to tile space.
 */
function projectX(x: number): number {
   return x / 360 + 0.5;
}

/**
 * Translate from WSG84 to tile space.
 */
function projectY(y: number): number {
   const sin = Math.sin((y * Math.PI) / 180);
   const y2 = 0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI;
   return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}
