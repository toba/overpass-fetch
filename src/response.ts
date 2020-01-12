import { ItemType, TagMap } from '@toba/osm-models';

export interface ResponseElement {
   type: ItemType;
   id: number;
   tags?: TagMap;
}

export interface ResponseWay extends ResponseElement {
   type: ItemType.Way;
   nodes: number[];
}

export interface ResponseNode extends ResponseElement {
   type: ItemType.Node;
   lat: number;
   lon: number;
}

export interface Response {
   version: number;
   generator: string;
   osm3s: {
      timestamp_osm_base: string;
      copyright: string;
   };
   elements: (ResponseWay | ResponseNode)[];
}
