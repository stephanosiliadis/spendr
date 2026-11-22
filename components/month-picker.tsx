"use client";

import { useState } from "react";
import { format, parse } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type MonthPickerProps = {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  id?: string;
  className?: string;
};

export function MonthPicker({
  value,
  onChange,
  max,
  id,
  className,
}: MonthPickerProps) {
  const selected = parse(value, "yyyy-MM", new Date());
  const maxDate = max ? parse(max, "yyyy-MM", new Date()) : undefined;
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selected.getFullYear());
  const monthNames = Array.from({ length: 12 }, (_, month) =>
    format(new Date(year, month, 1), "MMM"),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setYear(selected.getFullYear());
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            className,
          )}
        >
          <CalendarDays
            className="mr-2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          {format(selected, "MMMM yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="Previous year"
            onClick={() => setYear((current) => current - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            aria-label="Next year"
            disabled={!!maxDate && year >= maxDate.getFullYear()}
            onClick={() => setYear((current) => current + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {monthNames.map((label, month) => {
            const isSelected =
              selected.getFullYear() === year && selected.getMonth() === month;
            const isFuture = !!maxDate && new Date(year, month, 1) > maxDate;
            return (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={isSelected ? "secondary" : "ghost"}
                className="h-9"
                disabled={isFuture}
                aria-pressed={isSelected}
                onClick={() => {
                  onChange(format(new Date(year, month, 1), "yyyy-MM"));
                  setOpen(false);
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
