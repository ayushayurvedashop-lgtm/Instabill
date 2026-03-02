"use client";

import { cn } from "@/lib/utils";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { DateInput, dateInputStyle } from "@/components/ui/datefield-rac";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Button, DateRangePicker, Dialog, Group, Label, Popover, DateValue } from "react-aria-components";

export interface DateRangePickerRacProps {
    className?: string;
    value?: { start: DateValue; end: DateValue } | null;
    onChange?: (value: { start: DateValue; end: DateValue } | null) => void;
    label?: string;
    onDropdownTrigger?: () => void;
    isDropdownOpen?: boolean;
}

export function DateRangePickerRac({ className, value, onChange, label, onDropdownTrigger, isDropdownOpen }: DateRangePickerRacProps) {
    return (
        <DateRangePicker
            className={cn("space-y-2", className)}
            value={value}
            onChange={onChange}
        >
            {label && <Label className="text-sm font-medium text-foreground">{label}</Label>}
            <Group className="flex items-center min-h-11 md:min-h-12 w-full bg-white border border-gray-200 rounded-2xl md:rounded-[20px] shadow-sm px-3 md:px-4 gap-2 transition-all focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent">
                {/* Left: Calendar Icon */}
                <Button className="shrink-0 flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                    <CalendarIcon size={18} strokeWidth={2} />
                </Button>

                {/* Middle: Date Inputs */}
                <div className="flex-1 flex items-center justify-center text-gray-700 font-medium text-sm md:text-base min-w-0">
                    <DateInput slot="start" unstyled className="flex-1 text-center" />
                    <span aria-hidden="true" className="px-1 text-gray-300 font-normal">
                        -
                    </span>
                    <DateInput slot="end" unstyled className="flex-1 text-center" />
                </div>

                {/* Right: Dropdown Trigger */}
                {onDropdownTrigger && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDropdownTrigger();
                        }}
                        className={cn(
                            "shrink-0 flex w-8 h-8 md:w-9 md:h-9 items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 transition-all outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer ml-1",
                            isDropdownOpen && "bg-gray-100 ring-2 ring-accent/20"
                        )}
                    >
                        <ChevronDown size={18} className={cn("transition-transform duration-200", isDropdownOpen && "rotate-180")} />
                    </button>
                )}
            </Group>

            <Popover
                className="z-50 rounded-lg border border-border bg-white text-popover-foreground shadow-xl shadow-black/5 outline-none data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2"
                offset={4}
            >
                <Dialog className="max-h-[inherit] overflow-auto p-2">
                    <RangeCalendar />
                </Dialog>
            </Popover>
        </DateRangePicker>
    );
}
