import { isValidCoordinates, type Coordinates } from "./geo";

export type CityRecord = {
  city: string;
  state: string;
  lat: number;
  lng: number;
  areas: string[];
};

/**
 * Reference city list used for search, distance estimation and demo data.
 * Coordinates are approximate city-centre points, intentionally coarse.
 */
export const CITIES: CityRecord[] = [
  {
    city: "Ghaziabad",
    state: "Uttar Pradesh",
    lat: 28.6692,
    lng: 77.4538,
    areas: ["Indirapuram", "Vaishali", "Raj Nagar Extension", "Kavi Nagar"],
  },
  {
    city: "Noida",
    state: "Uttar Pradesh",
    lat: 28.5355,
    lng: 77.391,
    areas: ["Sector 62", "Sector 18", "Greater Noida West", "Sector 137"],
  },
  {
    city: "Delhi",
    state: "Delhi",
    lat: 28.6139,
    lng: 77.209,
    areas: ["Saket", "Rohini", "Dwarka", "Lajpat Nagar"],
  },
  {
    city: "Gurugram",
    state: "Haryana",
    lat: 28.4595,
    lng: 77.0266,
    areas: ["Sector 45", "DLF Phase 3", "Sohna Road", "Palam Vihar"],
  },
  {
    city: "Faridabad",
    state: "Haryana",
    lat: 28.4089,
    lng: 77.3178,
    areas: ["Sector 15", "Neharpar", "Ballabgarh"],
  },
  {
    city: "Mumbai",
    state: "Maharashtra",
    lat: 19.076,
    lng: 72.8777,
    areas: ["Andheri", "Bandra", "Dadar", "Powai"],
  },
  {
    city: "Thane",
    state: "Maharashtra",
    lat: 19.2183,
    lng: 72.9781,
    areas: ["Ghodbunder Road", "Vartak Nagar", "Kolshet"],
  },
  {
    city: "Pune",
    state: "Maharashtra",
    lat: 18.5204,
    lng: 73.8567,
    areas: ["Kothrud", "Baner", "Hadapsar", "Hinjewadi"],
  },
  {
    city: "Nagpur",
    state: "Maharashtra",
    lat: 21.1458,
    lng: 79.0882,
    areas: ["Dharampeth", "Sadar", "Manish Nagar"],
  },
  {
    city: "Bengaluru",
    state: "Karnataka",
    lat: 12.9716,
    lng: 77.5946,
    areas: ["Indiranagar", "Whitefield", "Jayanagar", "Hebbal"],
  },
  {
    city: "Mysuru",
    state: "Karnataka",
    lat: 12.2958,
    lng: 76.6394,
    areas: ["Vijayanagar", "Kuvempunagar"],
  },
  {
    city: "Hyderabad",
    state: "Telangana",
    lat: 17.385,
    lng: 78.4867,
    areas: ["Banjara Hills", "Gachibowli", "Kukatpally", "Secunderabad"],
  },
  {
    city: "Warangal",
    state: "Telangana",
    lat: 17.9689,
    lng: 79.5941,
    areas: ["Hanamkonda", "Kazipet"],
  },
  {
    city: "Chennai",
    state: "Tamil Nadu",
    lat: 13.0827,
    lng: 80.2707,
    areas: ["T. Nagar", "Adyar", "Anna Nagar", "Velachery"],
  },
  {
    city: "Coimbatore",
    state: "Tamil Nadu",
    lat: 11.0168,
    lng: 76.9558,
    areas: ["RS Puram", "Saibaba Colony"],
  },
  {
    city: "Kochi",
    state: "Kerala",
    lat: 9.9312,
    lng: 76.2673,
    areas: ["Kakkanad", "Edappally", "Fort Kochi"],
  },
  {
    city: "Thiruvananthapuram",
    state: "Kerala",
    lat: 8.5241,
    lng: 76.9366,
    areas: ["Kowdiar", "Pattom"],
  },
  {
    city: "Kolkata",
    state: "West Bengal",
    lat: 22.5726,
    lng: 88.3639,
    areas: ["Salt Lake", "Ballygunge", "Behala", "New Town"],
  },
  {
    city: "Bhubaneswar",
    state: "Odisha",
    lat: 20.2961,
    lng: 85.8245,
    areas: ["Patia", "Saheed Nagar"],
  },
  {
    city: "Patna",
    state: "Bihar",
    lat: 25.5941,
    lng: 85.1376,
    areas: ["Kankarbagh", "Boring Road"],
  },
  {
    city: "Lucknow",
    state: "Uttar Pradesh",
    lat: 26.8467,
    lng: 80.9462,
    areas: ["Gomti Nagar", "Hazratganj", "Aliganj"],
  },
  {
    city: "Kanpur",
    state: "Uttar Pradesh",
    lat: 26.4499,
    lng: 80.3319,
    areas: ["Swaroop Nagar", "Kidwai Nagar"],
  },
  {
    city: "Varanasi",
    state: "Uttar Pradesh",
    lat: 25.3176,
    lng: 82.9739,
    areas: ["Sigra", "Lanka"],
  },
  {
    city: "Agra",
    state: "Uttar Pradesh",
    lat: 27.1767,
    lng: 78.0081,
    areas: ["Tajganj", "Dayalbagh"],
  },
  {
    city: "Jaipur",
    state: "Rajasthan",
    lat: 26.9124,
    lng: 75.7873,
    areas: ["Vaishali Nagar", "Malviya Nagar", "Mansarovar"],
  },
  {
    city: "Jodhpur",
    state: "Rajasthan",
    lat: 26.2389,
    lng: 73.0243,
    areas: ["Ratanada", "Shastri Nagar"],
  },
  {
    city: "Udaipur",
    state: "Rajasthan",
    lat: 24.5854,
    lng: 73.7125,
    areas: ["Hiran Magri", "Fateh Sagar"],
  },
  {
    city: "Ahmedabad",
    state: "Gujarat",
    lat: 23.0225,
    lng: 72.5714,
    areas: ["Satellite", "Bopal", "Maninagar"],
  },
  { city: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311, areas: ["Adajan", "Vesu"] },
  { city: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812, areas: ["Alkapuri", "Gotri"] },
  {
    city: "Bhopal",
    state: "Madhya Pradesh",
    lat: 23.2599,
    lng: 77.4126,
    areas: ["Arera Colony", "Kolar Road"],
  },
  {
    city: "Indore",
    state: "Madhya Pradesh",
    lat: 22.7196,
    lng: 75.8577,
    areas: ["Vijay Nagar", "Sudama Nagar"],
  },
  {
    city: "Raipur",
    state: "Chhattisgarh",
    lat: 21.2514,
    lng: 81.6296,
    areas: ["Shankar Nagar", "Telibandha"],
  },
  {
    city: "Chandigarh",
    state: "Chandigarh",
    lat: 30.7333,
    lng: 76.7794,
    areas: ["Sector 17", "Sector 35"],
  },
  {
    city: "Ludhiana",
    state: "Punjab",
    lat: 30.901,
    lng: 75.8573,
    areas: ["Model Town", "Sarabha Nagar"],
  },
  {
    city: "Amritsar",
    state: "Punjab",
    lat: 31.634,
    lng: 74.8723,
    areas: ["Ranjit Avenue", "Lawrence Road"],
  },
  {
    city: "Dehradun",
    state: "Uttarakhand",
    lat: 30.3165,
    lng: 78.0322,
    areas: ["Rajpur Road", "Clement Town"],
  },
  { city: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362, areas: ["Beltola", "Six Mile"] },
  {
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    lat: 17.6868,
    lng: 83.2185,
    areas: ["MVP Colony", "Gajuwaka"],
  },
];

const CITY_BY_NAME = new Map(CITIES.map((record) => [record.city.toLowerCase(), record]));

export function findCity(city: string | null | undefined): CityRecord | null {
  if (!city) return null;
  return CITY_BY_NAME.get(city.trim().toLowerCase()) ?? null;
}

export function cityOptions(): string[] {
  return CITIES.map((record) => record.city).sort((a, b) => a.localeCompare(b));
}

/** Approximate centre point for a city (rounded for privacy). */
export function cityCoordinates(city: string | null | undefined): Coordinates | null {
  const record = findCity(city);
  if (!record) return null;
  const point = { lat: record.lat, lng: record.lng };
  return isValidCoordinates(point) ? point : null;
}

export function areasForCity(city: string | null | undefined): string[] {
  return findCity(city)?.areas ?? [];
}

export function cityStateLabel(city: string | null | undefined): string {
  const record = findCity(city);
  if (!record) return city ?? "Location not set";
  return `${record.city}, ${record.state}`;
}

/** Adds a small, deterministic offset so demo records do not stack on one point. */
export function offsetPoint(point: Coordinates, seed: string, maxKm = 6): Coordinates {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  const angle = (hash % 360) * (Math.PI / 180);
  const radiusKm = ((hash % 100) / 100) * maxKm;
  const latOffset = (radiusKm / 111) * Math.cos(angle);
  const lngOffset = (radiusKm / (111 * Math.cos((point.lat * Math.PI) / 180))) * Math.sin(angle);
  return {
    lat: Math.round((point.lat + latOffset) * 100) / 100,
    lng: Math.round((point.lng + lngOffset) * 100) / 100,
  };
}
