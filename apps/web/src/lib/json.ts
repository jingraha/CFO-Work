export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type Jsonify<T> = T extends Date
  ? string
  : T extends JsonValue
    ? T
    : T extends Array<infer U>
      ? Array<Jsonify<U>>
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : never;

export function toJson<T>(value: T): Jsonify<T> {
  return JSON.parse(JSON.stringify(value)) as Jsonify<T>;
}
