// Shapes returned by the Django API (/api/v1/). Money fields are decimal strings, e.g. "85.00".

export type Area = { id: number; name_bn: string; name_en: string };

export type Category = { id: number; name_bn: string; emoji: string; sort_order: number };

export type Slot = {
  id: number;
  label_bn: string;
  start_time: string; // "16:00:00"
  end_time: string;
  cutoff_minutes: number;
  open_today: boolean;
  closes_at_today: string;
};

export type Vendor = {
  id: number;
  code: string;
  business_name: string;
  about_bn: string;
  is_own_farm: boolean;
  delivery_fee: string;
  free_delivery_above: string;
  min_order: string;
  area_ids: number[];
  slot_ids: number[];
};

export type UnitKind = "kg" | "piece" | "other";

export type Product = {
  id: number;
  name_bn: string;
  vendor_id: number;
  vendor_name: string;
  category_id: number;
  category_name_bn: string;
  unit_label_bn: string;
  unit_kind: UnitKind;
  qty_step: string;
  price: string;
  previous_price: string | null;
  in_stock: boolean;
  badge_bn: string;
  emoji: string;
  bg_color: string;
};

export type OrderItem = {
  product_id: number | null;
  name_snapshot: string;
  unit_snapshot: string;
  unit_price: string;
  qty: string;
  line_total: string;
};

export type VendorOrder = {
  vendor_id: number;
  vendor_name: string;
  slot_id: number;
  slot_label_bn: string;
  status: string;
  status_bn: string;
  subtotal: string;
  delivery_fee: string;
  total: string;
  cancel_reason: string;
  items: OrderItem[];
};

export type Order = {
  number: string;
  customer_name: string;
  phone: string;
  area_id: number;
  area_name_bn: string;
  address_text: string;
  note: string;
  delivery_date: string;
  payment_method: string;
  grand_total: string;
  created_at: string;
  vendor_orders: VendorOrder[];
};

export type ApiError = { detail: string; errors: string[] };
