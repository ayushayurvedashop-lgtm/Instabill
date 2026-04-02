import React from "react";

interface CreateBillButtonProps {
    onClick?: () => void;
    className?: string;
}

const CreateBillButton: React.FC<CreateBillButtonProps> = ({ onClick, className = "" }) => {
    return (
        <button
            onClick={onClick}
            className={`group relative flex items-center justify-center rounded-xl bg-[#88DE7D] hover:bg-[#7cd472] text-[#02575c] text-sm font-bold px-5 py-2 overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 shadow-[0_0_20px_rgba(136,222,125,0.3)] hover:shadow-[0_0_30px_rgba(136,222,125,0.5)] min-w-[160px] ${className}`}
        >
            {/* Icon - moves to center on hover */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width={22}
                height={22}
                className="absolute left-6 transition-all duration-300 origin-center group-hover:left-1/2 group-hover:-translate-x-1/2 group-hover:rotate-45 group-hover:scale-110"
            >
                <path fill="none" d="M0 0h24v24H0z" />
                <path
                    fill="currentColor"
                    d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z"
                />
            </svg>

            {/* Text - slides out and fades on hover */}
            <span className="ml-7 transition-all duration-300 group-hover:translate-x-[5em] group-hover:opacity-0">
                Create New Bill
            </span>
        </button>
    );
};

export default CreateBillButton;
