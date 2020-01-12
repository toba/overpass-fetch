import { GeoJsonProperties, GeoJsonTypes } from 'geojson';

export type Tags = { [key: string]: string | number };

export type Point = [number, number, number?];

export type VectorGeometry = List<Point[]>;

export interface List<T> extends Array<T> {
   size?: number;
   start?: number;
   end?: number;
}

export interface Coordinate {
   x: number;
   y: number;
   /** Zoom */
   z: number;
}

export const enum LogLevel {
   None,
   Basic,
   All
}

/**
 * Indicates an axis: `0` for `x`, `1` for `y`.
 */
export type Axis = 0 | 1;

export interface Options {
   /** Maximum zoom (`0-24`) to preserve detail on */
   maxZoom: number;
   /** Simplification tolerance (higher means simpler) */
   tolerance: number;
   /** Tile extent */
   extent: number;
   /** Tile buffer on each side */
   buffer: number;
   /** Name of a feature property to be promoted to `feature.id` */
   promoteId?: string;
   /** Whether to generate feature IDs. Cannot be used with `promoteId`. */
   generateId: boolean;
   /** Whether to calculate line metrics */
   lineMetrics: boolean;
   debug: LogLevel;
   /** Maximum zoom in the tile index */
   indexMaxZoom: number;
   /** Maximum number of points per tile in the tile index */
   indexMaxPoints: number;
}

export interface VectorFeature {
   id?: string;
   type: GeoJsonTypes;
   geometry: VectorGeometry;
   minX: number;
   minY: number;
   maxX: number;
   maxY: number;
   tags: GeoJsonProperties;
}

export interface Tile {
   transformed: boolean;
   numPoints: number;
   numSimplified: number;
   numFeatures: number;
   source?: VectorFeature[];
   x: number;
   y: number;
   z: number;
   minX: number;
   minY: number;
   maxX: number;
   maxY: number;
   features: TileFeature[];
}

export interface TileFeature {
   id: string | number;
   type: number;
   geometry: VectorGeometry | Point;
}

export interface Slice {
   size: number;
   start: number;
   end: number;
}
