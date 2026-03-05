import { type DevicesQuery } from "@/models/device";
import { getDevices } from "@/services/devicesService";

export async function loadDevices(query: DevicesQuery) {
  return getDevices(query);
}
