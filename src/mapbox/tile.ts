import { GeoJsonType as Type } from '@toba/map';
import {
   Options,
   MemFeature,
   Tile,
   TileFeature,
   MemLine,
   MemPolygon,
   TileFeatureType,
   Tags
} from './types';
import { forEach } from '@toba/node-tools';
import { GeoJsonProperties } from 'geojson';

/**
 * Simplified tile generation.
 */
export function createTile(
   features: MemFeature[],
   z: number,
   tx: number,
   ty: number,
   options: Options
): Tile {
   const tolerance =
      z === options.maxZoom
         ? 0
         : options.tolerance / ((1 << z) * options.extent);

   const tile: Tile = {
      features: [],
      numPoints: 0,
      numSimplified: 0,
      numFeatures: features.length,
      source: undefined,
      x: tx,
      y: ty,
      z,
      transformed: false,
      minX: 2,
      minY: 1,
      maxX: -1,
      maxY: 0
   };
   for (const feature of features) {
      addFeature(tile, feature, tolerance, options);

      const minX = feature.minX;
      const minY = feature.minY;
      const maxX = feature.maxX;
      const maxY = feature.maxY;

      if (minX < tile.minX) {
         tile.minX = minX;
      }
      if (minY < tile.minY) {
         tile.minY = minY;
      }
      if (maxX > tile.maxX) {
         tile.maxX = maxX;
      }
      if (maxY > tile.maxY) {
         tile.maxY = maxY;
      }
   }
   return tile;
}

function addFeature(
   tile: Tile,
   feature: MemFeature,
   tolerance: number,
   options: Options
) {
   const geom = feature.geometry;
   const type = feature.type;
   const simplified: number[] = [];

   switch (type) {
      case Type.Point:
      case Type.MultiPoint:
         const line = geom as MemLine;
         for (let i = 0; i < line.length; i += 3) {
            simplified.push(line[i], line[i + 1]);
            tile.numPoints++;
            tile.numSimplified++;
         }
         break;
      case Type.Line:
         addLine(simplified, geom as MemLine, tile, tolerance, false, false);
         break;
      case Type.MultiLine:
      case Type.Polygon:
         forEach(geom as MemPolygon, (line, i) =>
            addLine(
               simplified,
               line,
               tile,
               tolerance,
               type === Type.Polygon,
               i === 0
            )
         );
         break;
      case Type.MultiPolygon:
         forEach(geom as MemPolygon[], p =>
            forEach(p, (line, i) =>
               addLine(simplified, line, tile, tolerance, true, i === 0)
            )
         );
         break;
   }

   if (simplified.length) {
      let tags: GeoJsonProperties = feature.tags ?? null;

      if (type === Type.Line && options.lineMetrics) {
         const line = geom as MemLine;
         const size = line.size ?? 1;
         tags = {};

         for (const key in feature.tags) {
            tags[key] = feature.tags[key];
         }
         tags['mapbox_clip_start'] = line.start ?? 0 / size;
         tags['mapbox_clip_end'] = line.end ?? 0 / size;
      }

      const tileFeature: TileFeature = {
         geometry: simplified,
         type:
            type === Type.Polygon || type === Type.MultiPolygon
               ? TileFeatureType.Polygon
               : type === Type.Line || type === Type.MultiLine
               ? TileFeatureType.Line
               : TileFeatureType.Point,
         tags
      };
      if (feature.id !== undefined) {
         tileFeature.id = feature.id;
      }
      tile.features.push(tileFeature);
   }
}

function addLine(
   result: number[],
   geom: MemLine,
   tile: Tile,
   tolerance: number,
   isPolygon: boolean,
   isOuter: boolean
) {
   const sqTolerance = tolerance * tolerance;

   if (
      tolerance > 0 &&
      (geom.size ?? 0) < (isPolygon ? sqTolerance : tolerance)
   ) {
      tile.numPoints += geom.length / 3;
      return;
   }

   const ring: number[] = [];

   for (let i = 0; i < geom.length; i += 3) {
      if (tolerance === 0 || geom[i + 2] > sqTolerance) {
         tile.numSimplified++;
         ring.push(geom[i], geom[i + 1]);
      }
      tile.numPoints++;
   }

   if (isPolygon) {
      rewind(ring, isOuter);
   }

   // TODO: pushing array to array?
   result.push(ring);
}

function rewind(ring: number[], clockwise: boolean) {
   let area = 0;

   for (let i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
      area += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1]);
   }
   if (area > 0 === clockwise) {
      for (let i = 0, len = ring.length; i < len / 2; i += 2) {
         const x = ring[i];
         const y = ring[i + 1];
         ring[i] = ring[len - 2 - i];
         ring[i + 1] = ring[len - 1 - i];
         ring[len - 2 - i] = x;
         ring[len - 1 - i] = y;
      }
   }
}
