import { Filter, MapPin, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BLOOD_GROUPS, REQUEST_TYPES, URGENCIES, type BloodGroup, type RequestType, type Urgency } from "@/lib/domain";
import { REQUEST_TYPE_SHORT_LABELS, URGENCY_LABELS } from "@/lib/labels";
import { cityOptions } from "@/lib/cities";
import { cn } from "@/lib/utils";

export type FilterState = {
  q: string;
  bloodGroup: BloodGroup | "";
  city: string;
  area: string;
  urgency: Urgency | "";
  requestType: RequestType | "";
  requiredFrom: string;
  requiredTo: string;
  radiusKm: string;
  sort: "match" | "recent" | "urgency" | "distance";
};

export const EMPTY_FILTERS: FilterState = {
  q: "",
  bloodGroup: "",
  city: "",
  area: "",
  urgency: "",
  requestType: "",
  requiredFrom: "",
  requiredTo: "",
  radiusKm: "",
  sort: "match",
};

export function countActiveFilters(filters: FilterState): number {
  return [
    filters.q,
    filters.bloodGroup,
    filters.city,
    filters.area,
    filters.urgency,
    filters.requestType,
    filters.requiredFrom,
    filters.requiredTo,
    filters.radiusKm,
  ].filter(Boolean).length;
}

function FilterFields({
  filters,
  onChange,
  onLocationRequest,
  hasLocation,
  locating,
  cities,
}: {
  filters: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  onLocationRequest?: () => void;
  hasLocation?: boolean;
  locating?: boolean;
  cities: string[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="filter-q">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="filter-q"
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Hospital, area, reference or note"
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-blood">Blood group</Label>
        <Select
          value={filters.bloodGroup || "any"}
          onValueChange={(value) => onChange({ bloodGroup: value === "any" ? "" : (value as BloodGroup) })}
        >
          <SelectTrigger id="filter-blood">
            <SelectValue placeholder="Any group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any compatible group</SelectItem>
            {BLOOD_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-urgency">Urgency</Label>
        <Select
          value={filters.urgency || "any"}
          onValueChange={(value) => onChange({ urgency: value === "any" ? "" : (value as Urgency) })}
        >
          <SelectTrigger id="filter-urgency">
            <SelectValue placeholder="Any urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any urgency</SelectItem>
            {URGENCIES.map((urgency) => (
              <SelectItem key={urgency} value={urgency}>
                {URGENCY_LABELS[urgency]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-type">Request type</Label>
        <Select
          value={filters.requestType || "any"}
          onValueChange={(value) => onChange({ requestType: value === "any" ? "" : (value as RequestType) })}
        >
          <SelectTrigger id="filter-type">
            <SelectValue placeholder="Any type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any type</SelectItem>
            {REQUEST_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {REQUEST_TYPE_SHORT_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-city">City</Label>
        <Input
          id="filter-city"
          list="filter-city-options"
          value={filters.city}
          onChange={(event) => onChange({ city: event.target.value })}
          placeholder="Any city"
        />
        <datalist id="filter-city-options">
          {[...new Set([...cities, ...cityOptions()])].map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-area">Area or locality</Label>
        <Input
          id="filter-area"
          value={filters.area}
          onChange={(event) => onChange({ area: event.target.value })}
          placeholder="Any area"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-from">Needed from</Label>
        <Input
          id="filter-from"
          type="date"
          value={filters.requiredFrom}
          onChange={(event) => onChange({ requiredFrom: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-to">Needed until</Label>
        <Input
          id="filter-to"
          type="date"
          value={filters.requiredTo}
          onChange={(event) => onChange({ requiredTo: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-radius">Distance</Label>
        <Select
          value={filters.radiusKm || "any"}
          onValueChange={(value) => onChange({ radiusKm: value === "any" ? "" : value })}
        >
          <SelectTrigger id="filter-radius">
            <SelectValue placeholder="Any distance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any distance</SelectItem>
            <SelectItem value="5">Within 5 km</SelectItem>
            <SelectItem value="15">Within 15 km</SelectItem>
            <SelectItem value="40">Within 40 km</SelectItem>
            <SelectItem value="100">Within 100 km</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-sort">Sort by</Label>
        <Select
          value={filters.sort}
          onValueChange={(value) => onChange({ sort: value as FilterState["sort"] })}
        >
          <SelectTrigger id="filter-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="match">Best match for me</SelectItem>
            <SelectItem value="urgency">Most urgent first</SelectItem>
            <SelectItem value="recent">Newest first</SelectItem>
            <SelectItem value="distance">Nearest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {onLocationRequest ? (
        <div className="space-y-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onLocationRequest}
            disabled={locating}
          >
            <MapPin className="size-4" aria-hidden="true" />
            {hasLocation ? "Refresh my location" : locating ? "Getting your location…" : "Use my location for distance"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Location is optional and only used to estimate distance. We round it to about a kilometre and never publish
            it. Your exact address is never stored on requests.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function RequestFilters({
  filters,
  onChange,
  onReset,
  cities,
  resultCount,
  onLocationRequest,
  hasLocation,
  locating,
}: {
  filters: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  onReset: () => void;
  cities: string[];
  resultCount: number;
  onLocationRequest?: () => void;
  hasLocation?: boolean;
  locating?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <>
      {/* Mobile: sheet */}
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-1">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters
              {activeCount > 0 ? (
                <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Filter className="size-4" aria-hidden="true" />
                Filter requests
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-5 pb-6">
              <FilterFields
                filters={filters}
                onChange={onChange}
                cities={cities}
                {...(onLocationRequest ? { onLocationRequest } : {})}
                {...(hasLocation !== undefined ? { hasLocation } : {})}
                {...(locating !== undefined ? { locating } : {})}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onReset}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reset
                </Button>
                <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                  Show {resultCount} result{resultCount === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        {activeCount > 0 ? (
          <Button variant="ghost" onClick={onReset}>
            <X className="size-4" aria-hidden="true" />
            Clear
          </Button>
        ) : null}
      </div>

      {/* Desktop: inline panel */}
      <div className={cn("surface hidden space-y-5 p-5 lg:block")}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold">
            <Filter className="size-4 text-primary" aria-hidden="true" />
            Filters
          </h2>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Reset all
            </button>
          ) : null}
        </div>
        <FilterFields
          filters={filters}
          onChange={onChange}
          cities={cities}
          {...(onLocationRequest ? { onLocationRequest } : {})}
          {...(hasLocation !== undefined ? { hasLocation } : {})}
          {...(locating !== undefined ? { locating } : {})}
        />
      </div>
    </>
  );
}
