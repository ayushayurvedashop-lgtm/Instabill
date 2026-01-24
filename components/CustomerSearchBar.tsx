import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, User, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Customer } from '../types';

interface CustomerSearchBarProps {
    value: string;
    onChange: (name: string) => void;
    customers: Customer[];
    onAddNew: () => void;
    className?: string;
}

const CustomerSearchBar: React.FC<CustomerSearchBarProps> = ({
    value,
    onChange,
    customers,
    onAddNew,
    className = '',
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter customers based on search query - calculate directly for immediate response
    const getFilteredCustomers = () => {
        if (!value.trim()) return customers.slice(0, 6);
        const query = value.toLowerCase().trim();
        return customers
            .filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.phone.includes(query)
            )
            .slice(0, 6);
    };

    const filteredCustomers = getFilteredCustomers();

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsFocused(false);
                setHighlightedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset highlight when query changes
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isFocused) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev < filteredCustomers.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev =>
                prev > 0 ? prev - 1 : filteredCustomers.length - 1
            );
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && filteredCustomers[highlightedIndex]) {
                onChange(filteredCustomers[highlightedIndex].name);
                setIsFocused(false);
                setHighlightedIndex(-1);
                inputRef.current?.blur();
            }
        } else if (e.key === 'Escape') {
            setIsFocused(false);
            setHighlightedIndex(-1);
            inputRef.current?.blur();
        }
    };

    const handleSelectCustomer = (customer: Customer) => {
        onChange(customer.name);
        setIsFocused(false);
        setHighlightedIndex(-1);
    };

    // Simplified Animation variants
    const dropdownVariants = {
        hidden: { opacity: 0, scale: 0.95, y: -10 },
        show: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.1 }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: -10,
            transition: { duration: 0.1 }
        },
    };

    return (
        <div ref={wrapperRef} className={`relative w-full ${className}`}>
            {/* Search Input Container */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <User className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search customer by name or phone..."
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-white border-2 border-gray-200 rounded-xl pl-12 pr-12 py-3.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#BCE32D] focus:ring-2 focus:ring-[#BCE32D]/30 transition-all shadow-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <AnimatePresence mode="popLayout">
                            {value ? (
                                <motion.div
                                    key="user-check"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <User className="w-4 h-4 text-[#12332A]" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="search"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <Search className="w-4 h-4 text-gray-400" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Add New Customer Button */}
                <button
                    onClick={onAddNew}
                    className="flex items-center gap-2 px-4 py-3.5 bg-[#12332A] hover:bg-[#1a4438] text-white rounded-xl font-semibold text-sm transition-all shadow-sm whitespace-nowrap"
                >
                    <UserPlus size={18} />
                    <span className="hidden xl:inline">Add Customer</span>
                </button>
            </div>

            {/* Dropdown Suggestions */}
            <AnimatePresence>
                {isFocused && (
                    <motion.div
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
                        style={{ marginRight: '140px' }}
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                    >
                        <ul className="divide-y divide-gray-50">
                            {filteredCustomers.length > 0 ? (
                                filteredCustomers.map((customer, index) => (
                                    <li
                                        key={customer.id}
                                        className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${index === highlightedIndex
                                            ? 'bg-[#12332A]/5'
                                            : 'hover:bg-gray-50'
                                            }`}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectCustomer(customer);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                                                <User size={16} className="text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Phone size={10} />
                                                    {customer.phone}
                                                </p>
                                            </div>
                                        </div>
                                        {index === highlightedIndex && (
                                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                                Enter ↵
                                            </span>
                                        )}
                                    </li>
                                ))
                            ) : (
                                <li className="px-4 py-4 text-center">
                                    <p className="text-sm text-gray-500">No customers found</p>
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onAddNew();
                                        }}
                                        className="mt-2 text-sm font-semibold text-[#12332A] hover:underline"
                                    >
                                        + Add as new customer
                                    </button>
                                </li>
                            )}
                        </ul>

                        {/* Footer hint */}
                        {filteredCustomers.length > 0 && (
                            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                                <div className="flex items-center justify-between text-[11px] text-gray-400">
                                    <span>↑↓ Navigate</span>
                                    <span>↵ Select</span>
                                    <span>Esc Close</span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerSearchBar;
