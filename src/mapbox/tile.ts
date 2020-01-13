import { GeoJsonType as Type } from '@toba/map';
import {
   Options,
   MemFeature,
   Tile,
   TileFeature,
   MemLine,
   MemPolygon,
   TileFeatureType,
   TileLine
} from './types';
import { forEach } from '@toba/node-tools';
import { GeoJsonProperties } from 'geojson';

function eachPoint(
   line: MemLine,
   fn: (x: number, y: number, zoom: number) => void
) {
   for (let i = 0; i < line.length; i += 3) {
      fn(line[i], line[i + 1], line[i + 2]);
   }
}

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

   forEach(features, f => {
      addFeature(tile, f, tolerance, options);

      const minX = f.minX;
      const minY = f.minY;
      const maxX = f.maxX;
      const maxY = f.maxY;

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
   });

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
   const simplified: TileLine | TileLine[] = [];

   switch (type) {
      case Type.Point:
      case Type.MultiPoint:
         eachPoint(geom as MemLine, (x, y) => {
            (simplified as TileLine).push(x, y);
            tile.numPoints++;
            tile.numSimplified++;
         });
         break;
      case Type.Line:
         addLine(
            simplified as TileLine[],
            geom as MemLine,
            tile,
            tolerance,
            false,
            false
         );
         break;
      case Type.MultiLine:
      case Type.Polygon:
         forEach(geom as MemPolygon, (line, i) =>
            addLine(
               simplified as TileLine[],
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
               addLine(
                  simplified as TileLine[],
                  line,
                  tile,
                  tolerance,
                  true,
                  i === 0
               )
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
   result: TileLine[],
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

   eachPoint(geom, (x, y, z) => {
      if (tolerance === 0 || z > sqTolerance) {
         tile.numSimplified++;
         ring.push(x, y);
      }
      tile.numPoints++;
   });

   if (isPolygon) {
      rewind(ring, isOuter);
   }
   result.push(ring);
}

function rewind(ring: TileLine, clockwise: boolean) {
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
