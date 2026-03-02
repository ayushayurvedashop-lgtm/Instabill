import React, { createContext, useContext } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

const SwitchContext = createContext<{
    value: string;
    onChange: (value: string) => void;
} | null>(null);

interface SwitchProps {
    children: React.ReactNode;
    name?: string;
    size?: "small" | "medium" | "large";
    style?: React.CSSProperties;
    value: string;
    onChange: (value: string) => void;
}

export const Switch = ({ children, name = "default", size = "medium", style, value, onChange }: SwitchProps) => {
    return (
        <SwitchContext.Provider value={{ value, onChange }}>
            <div
                className={clsx(
                    "flex bg-gray-100 p-1 border border-gray-200",
                    size === "small" && "h-8 rounded-lg",
                    size === "medium" && "h-10 rounded-lg",
                    size === "large" && "h-12 rounded-xl"
                )}
                style={style}>
                {React.Children.map(children, (child) =>
                    React.cloneElement(child as React.ReactElement<SwitchControlProps>, { size, name }))}
            </div>
        </SwitchContext.Provider>
    );
};

interface SwitchControlProps {
    label?: string;
    value: string;
    disabled?: boolean;
    name?: string;
    size?: "small" | "medium" | "large";
    icon?: React.ReactNode;
    activeClassName?: string;
}

const SwitchControl = ({
    label,
    value,
    disabled = false,
    name,
    size = "medium",
    icon,
    activeClassName
}: SwitchControlProps) => {
    const context = useContext(SwitchContext);
    const checked = value === context?.value;

    const handleClick = () => {
        if (!disabled && context && value !== context.value) {
            context.onChange(value);
        }
    };

    return (
        <label
            className={clsx("flex flex-1 h-full", disabled && "cursor-not-allowed pointer-events-none")}
            onClick={handleClick}
        >
            <input
                type="radio"
                name={name}
                value={value}
                disabled={disabled}
                checked={checked}
                onChange={() => { }}
                className="hidden"
            />
            <span
                className={twMerge(clsx(
                    "flex items-center justify-center flex-1 cursor-pointer font-bold font-sans duration-150 transition-all",
                    checked
                        ? "bg-white text-gray-900 rounded-md shadow-sm"
                        : "text-gray-500 hover:text-gray-700",
                    checked && activeClassName, // Apply custom active class if checked
                    disabled && "text-gray-400",
                    !icon && size === "small" && "text-xs px-3",
                    !icon && size === "medium" && "text-sm px-3",
                    !icon && size === "large" && "text-base px-4",
                    icon && size === "small" && "py-1 px-2",
                    icon && size === "medium" && "py-2 px-3",
                    icon && size === "large" && "p-3"
                ))}
            >
                {icon ? <span className={clsx(size === "large" && "scale-125")}>{icon}</span> : label}
            </span>
        </label>
    );
};

Switch.Control = SwitchControl;
