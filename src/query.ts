import { BoundingBox } from '@toba/osm-models';
import { Format, Statement, SortBy } from './types';

/**
 * An Overpass query.
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
 */
export class Query {
   /**
    * The maximum allowed runtime for the query in seconds, as expected by the
    * user. If the query runs longer than this time, the server may abort the
    * query with a timeout. The second effect is, the higher this value, the
    * more probably the server rejects the query before executing it.
    *
    * The default is `180`.
    */
   timeout: number;

   /**
    * The maximum allowed memory for the query in bytes RAM on the server, as
    * expected by the user. If the query needs more RAM than this value, the
    * server may abort the query with a memory exhaustion. The second effect is,
    * the higher this value, the more probably the server rejects the query
    * before executing it.
    *
    * So, if you send a really complex big query, prefix it with a higher value;
    * e.g., "1073741824" for a gigabyte. The maximum value highly depends on the
    * current server load, e.g. requests for 2GB will likely be rejected during
    * peak hours, as they don't fit into the overall resource management.
    * Technically speaking, maxsize is treated as a 64bit signed number.
    *
    * The default is `536870912` (512 MB).
    */
   maxSize: number;
   outputAs: Format;
   /**
    * The global `bbox` setting can define a bounding box that is then
    * implicitly used in all statements (unless a statement specifies a
    * different explicit `bbox`). The global bounding box default if no `bbox`
    * is specified is "the entire world".
    *
    * In a standard Overpass QL program, a bounding box is constructed with two
    * decimal degree coordinate pairs in `ISO 6709` standard order and format,
    * and each value is separated with a comma. The values are, in order:
    * *southern-most latitude*, *western-most longitude*,
    * *northern-most latitude*, *eastern-most longitude*.
    *
    * @example
    * // around part of Rio de Janeiro, Brazil
    * [-23, -43.1, -22.8, -43.3]
    */
   boundingBox: BoundingBox;

   /**
    * Global setting which modifies an Overpass QL query to examine attic data,
    * and return results based on the OpenStreetMap database as of the date
    * specified. This setting can be useful, for example, to reconstruct data
    * that has been vandalized, or simply to view an object as it existed in the
    * database at some point in the past.
    *
    * It consists of the identifier date, followed by `:` and then an
    * OpenStreetMap database standard `ISO 8601` date enclosed in quotes, in the
    * format `YYYY-MM-DDThh:mm:ssZ`.
    */
   date: Date;

   sortBy?: SortBy;

   union: Statement[];

   constructor(box: BoundingBox) {
      this.boundingBox = box;
   }

   /**
    * Convert query instance to string for transmission to the API.
    *
    * @example
    * [out:json][timeout:25];
    * (
    *    node["highway"]({{bbox}});
    *    way["highway"]({{bbox}});
    *    relation["highway"]({{bbox}});
    * );
    * out body;
    * >;
    * out body qt;
    */
   toString(): string {
      return '';
   }
}
