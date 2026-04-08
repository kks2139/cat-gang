/* eslint-disable @typescript-eslint/no-explicit-any */

export { };

declare global {
  interface Window {
    kakao: typeof kakao;
  }

  namespace kakao {
    /**
     * 카카오맵 SDK 로드 함수 
     * autoload=false 파라미터 사용 시 명시적으로 호출해야 함
     */
    function init(appKey: string): void;

    namespace maps {
      /**
       * 핵심 지도 클래스
       */
      function load(callback: () => void): void;

      class Map {
        constructor(container: HTMLElement, options?: MapOptions);
        setCenter(latlng: LatLng): void;
        getCenter(): LatLng;
        setLevel(level: number, options?: { animate: boolean | { duration: number } }): void;
        getLevel(): number;
        setMapTypeId(mapTypeId: MapTypeId): void;
        getMapTypeId(): MapTypeId;
        setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
        getBounds(): LatLngBounds;
        setMinLevel(minLevel: number): void;
        setMaxLevel(maxLevel: number): void;
        setDraggable(draggable: boolean): void;
        getDraggable(): boolean;
        setZoomable(zoomable: boolean): void;
        getZoomable(): boolean;
        setKeyboardShortcuts(active: boolean): void;
        getKeyboardShortcuts(): boolean;
        setCopyrightPosition(copyrightPosition: CopyrightPosition, reversed?: boolean): void;
        relayout(): void;
        addControl(control: any, position: ControlPosition): void;
        removeControl(control: any): void;
        addOverlayMapTypeId(mapTypeId: MapTypeId): void;
        removeOverlayMapTypeId(mapTypeId: MapTypeId): void;
        getNode(): HTMLElement;

        // 추가된 핵심 이동 메서드
        panTo(latlng: LatLng | Coords, padding?: number): void;
        panBy(dx: number, dy: number): void;
      }

      interface MapOptions {
        center: LatLng;
        level?: number;
        mapTypeId?: MapTypeId;
        draggable?: boolean;
        scrollwheel?: boolean;
        disableDoubleClick?: boolean;
        disableDoubleClickZoom?: boolean;
        projectionId?: string;
        tileAnimation?: boolean;
        keyboardShortcuts?: boolean | { speed: number };
      }

      /**
       * 좌표 및 기하 관련 클래스
       */
      class LatLng {
        constructor(latitude: number, longitude: number);
        getLat(): number;
        getLng(): number;
        equals(latlng: LatLng): boolean;
        toString(): string;
        toCoords(): Coords;
      }

      class LatLngBounds {
        constructor(sw?: LatLng, ne?: LatLng);
        isEmpty(): boolean;
        extend(latlng: LatLng): void;
        getSouthWest(): LatLng;
        getNorthEast(): LatLng;
        contain(latlng: LatLng): boolean;
      }

      class Coords {
        constructor(x: number, y: number);
        getX(): number;
        getY(): number;
        toLatLng(): LatLng;
      }

      class Point {
        constructor(x: number, y: number);
        equals(point: Point): boolean;
        toString(): string;
      }

      class Size {
        constructor(width: number, height: number);
        equals(size: Size): boolean;
        toString(): string;
      }

      /**
       * 오버레이 (마커, 정보창, 커스텀 오버레이)
       */
      class Marker {
        constructor(options: MarkerOptions);
        setMap(map: Map | Roadview | null): void;
        getMap(): Map | Roadview | null;
        setImage(image: MarkerImage): void;
        getImage(): MarkerImage | null;
        setPosition(position: LatLng | Coords): void;
        getPosition(): LatLng;
        setZIndex(zIndex: number): void;
        getZIndex(): number;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        setTitle(title: string): void;
        getTitle(): string;
        setDraggable(draggable: boolean): void;
        getDraggable(): boolean;
        setClickable(clickable: boolean): void;
        getClickable(): boolean;
        setAltitude(altitude: number): void;
        getAltitude(): number;
        setRange(range: number): void;
        getRange(): number;
        setOpacity(opacity: number): void;
        getOpacity(): number;
      }

      interface MarkerOptions {
        map?: Map | Roadview;
        position: LatLng | Coords;
        image?: MarkerImage;
        title?: string;
        draggable?: boolean;
        clickable?: boolean;
        zIndex?: number;
        altitude?: number;
        range?: number;
        opacity?: number;
      }

      class MarkerImage {
        constructor(src: string, size: Size, options?: MarkerImageOptions);
      }

      interface MarkerImageOptions {
        alt?: string;
        coords?: string;
        offset?: Point;
        shape?: string;
        spriteOrigin?: Point;
        spriteSize?: Size;
      }

      class InfoWindow {
        constructor(options: InfoWindowOptions);
        open(map: Map | Roadview, marker?: Marker): void;
        close(): void;
        getMap(): Map | Roadview | null;
        setPosition(position: LatLng | Coords): void;
        getPosition(): LatLng;
        setContent(content: string | HTMLElement): void;
        getContent(): string | HTMLElement;
        setZIndex(zIndex: number): void;
        getZIndex(): number;
        setRange(range: number): void;
        getRange(): number;
        setAltitude(altitude: number): void;
        getAltitude(): number;
      }

      interface InfoWindowOptions {
        content?: string | HTMLElement;
        disableAutoPan?: boolean;
        map?: Map | Roadview;
        position?: LatLng | Coords;
        removable?: boolean;
        zIndex?: number;
        altitude?: number;
        range?: number;
      }

      class CustomOverlay {
        constructor(options: CustomOverlayOptions);
        setMap(map: Map | Roadview | null): void;
        getMap(): Map | Roadview | null;
        setPosition(position: LatLng | Coords): void;
        getPosition(): LatLng;
        setContent(content: string | HTMLElement): void;
        getContent(): string | HTMLElement;
        setZIndex(zIndex: number): void;
        getZIndex(): number;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        setAltitude(altitude: number): void;
        getAltitude(): number;
        setRange(range: number): void;
        getRange(): number;
      }

      interface CustomOverlayOptions {
        clickable?: boolean;
        content?: string | HTMLElement;
        map?: Map | Roadview;
        position?: LatLng | Coords;
        xAnchor?: number;
        yAnchor?: number;
        zIndex?: number;
        altitude?: number;
        range?: number;
      }

      /**
       * 도형 (Polyline, Polygon, Circle, Rectangle, Ellipse)
       */
      abstract class AbstractShape {
        setMap(map: Map | Roadview | null): void;
        getMap(): Map | Roadview | null;
        setOptions(options: object): void;
        setVisible(visible: boolean): void;
        getVisible(): boolean;
        setZIndex(zIndex: number): void;
        getZIndex(): number;
      }

      class Polyline extends AbstractShape {
        constructor(options: PolylineOptions);
        setPath(path: LatLng[] | Coords[]): void;
        getPath(): LatLng[];
        getLength(): number;
      }

      interface PolylineOptions {
        endArrow?: boolean;
        map?: Map;
        path: LatLng[] | Coords[] | LatLng[][] | Coords[][];
        strokeWeight?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeStyle?: StrokeStyle;
        zIndex?: number;
      }

      class Polygon extends AbstractShape {
        constructor(options: PolygonOptions);
        setPath(path: LatLng[] | Coords[] | LatLng[][] | Coords[][]): void;
        getPath(): LatLng[] | LatLng[][];
        getLength(): number;
        getArea(): number;
      }

      interface PolygonOptions {
        map?: Map;
        path: LatLng[] | Coords[] | LatLng[][] | Coords[][];
        strokeWeight?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeStyle?: StrokeStyle;
        fillColor?: string;
        fillOpacity?: number;
        zIndex?: number;
      }

      class Circle extends AbstractShape {
        constructor(options: CircleOptions);
        setPosition(position: LatLng | Coords): void;
        getPosition(): LatLng;
        setRadius(radius: number): void;
        getRadius(): number;
      }

      interface CircleOptions {
        map?: Map;
        center: LatLng | Coords;
        radius: number;
        strokeWeight?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeStyle?: StrokeStyle;
        fillColor?: string;
        fillOpacity?: number;
        zIndex?: number;
      }

      /**
       * 서비스 라이브러리 (libraries=services)
       */
      namespace services {
        type ServiceCategoryCode = 'MT1' | 'CS2' | 'PS3' | 'SC4' | 'AC5' | 'PK6' | 'OL7' | 'SW8' | 'BK9' | 'CT1' | 'AG2' | 'PO3' | 'AT4' | 'AD5' | 'FD6' | 'CE7' | 'HP8' | 'PM9';

        class Places {
          constructor(map?: Map);
          keywordSearch(keyword: string, callback: (result: any[], status: Status, pagination: Pagination) => void, options?: PlacesOptions): void;
          categorySearch(categoryCode: ServiceCategoryCode, callback: (result: any[], status: Status, pagination: Pagination) => void, options?: PlacesOptions): void;
        }

        interface PlacesOptions {
          location?: LatLng;
          radius?: number;
          bounds?: LatLngBounds;
          size?: number;
          page?: number;
          sort?: SortBy;
          useMapCenter?: boolean;
          useMapBounds?: boolean;
        }

        enum SortBy {
          DISTANCE = 'DISTANCE',
          ACCURACY = 'ACCURACY'
        }

        class Pagination {
          totalCount: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
          count: number;
          current: number;
          nextPage(): void;
          prevPage(): void;
          gotoPage(page: number): void;
          gotoFirst(): void;
          gotoLast(): void;
        }

        class Geocoder {
          constructor();
          addressSearch(addr: string, callback: (result: any[], status: Status) => void, options?: { page?: number; size?: number }): void;
          coord2Address(x: number, y: number, callback: (result: any[], status: Status) => void, options?: { coord?: CoordsType }): void;
          coord2RegionCode(x: number, y: number, callback: (result: any[], status: Status) => void, options?: { coord?: CoordsType }): void;
        }

        type CoordsType = 'WGS84' | 'WCONGNAMUL' | 'CONGNAMUL' | 'WTM' | 'TM';

        enum Status {
          OK = 'OK',
          ZERO_RESULT = 'ZERO_RESULT',
          ERROR = 'ERROR'
        }
      }

      /**
       * 이벤트
       */
      namespace event {
        function addListener(target: any, type: string, callback: (...args: any[]) => void): void;
        function removeListener(target: any, type: string, callback: (...args: any[]) => void): void;
        function trigger(target: any, type: string, data?: any): void;
      }

      /**
       * 열거형 및 상수
       */
      enum MapTypeId {
        ROADMAP = 1,
        SKYVIEW = 2,
        HYBRID = 3,
        BICYCLE = 4,
        TERRAIN = 5,
        OVERLAY = 6,
        USE_DISTRICT = 7,
        TRAFFIC = 8,
        ROADVIEW = 9,
        BICYCLE_HYBRID = 10
      }

      enum ControlPosition {
        TOP = 0,
        TOPLEFT = 1,
        TOPRIGHT = 2,
        LEFT = 3,
        RIGHT = 4,
        BOTTOMLEFT = 5,
        BOTTOM = 6,
        BOTTOMRIGHT = 7
      }

      enum CopyrightPosition {
        BOTTOMLEFT = 0,
        BOTTOMRIGHT = 1
      }

      type StrokeStyle = 'solid' | 'shortdash' | 'shortdot' | 'shortdashdot' | 'shortdashdotdot' | 'dot' | 'dash' | 'dashdot' | 'longdash' | 'longdashdot' | 'longdashdotdot';

      /** 로드뷰 관련 */
      class Roadview {
        constructor(container: HTMLElement, options?: RoadviewOptions);
        setPanoId(panoId: number, position: LatLng): void;
        getPanoId(): number;
        setViewpoint(viewpoint: Viewpoint): void;
        getViewpoint(): Viewpoint;
        getPosition(): LatLng;
        relayout(): void;
      }

      interface RoadviewOptions {
        panoId?: number;
        panoX?: number;
        panoY?: number;
        tilt?: number;
        pan?: number;
        fov?: number;
      }

      interface Viewpoint {
        pan: number;
        tilt: number;
        zoom?: number;
      }

      class RoadviewClient {
        constructor();
        getNearestPanoId(position: LatLng, radius: number, callback: (panoId: number | null) => void): void;
      }
    }
  }
}