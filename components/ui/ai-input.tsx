"use client"

import React from "react"
import { cx } from "class-variance-authority"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
// import { Send, Mic, Square } from "lucide-react" // Expecting lucide-react to be installed

interface OrbProps {
    dimension?: string
    className?: string
    tones?: {
        base?: string
        accent1?: string
        accent2?: string
        accent3?: string
    }
    spinDuration?: number
}

const ColorOrb: React.FC<OrbProps> = ({
    dimension = "192px",
    className,
    tones,
    spinDuration = 20,
}) => {
    const fallbackTones = {
        base: "oklch(95% 0.02 264.695)",
        accent1: "oklch(75% 0.15 350)",
        accent2: "oklch(80% 0.12 200)",
        accent3: "oklch(78% 0.14 280)",
    }

    const palette = { ...fallbackTones, ...tones }

    const dimValue = parseInt(dimension.replace("px", ""), 10)

    const blurStrength =
        dimValue < 50 ? Math.max(dimValue * 0.008, 1) : Math.max(dimValue * 0.015, 4)

    const contrastStrength =
        dimValue < 50 ? Math.max(dimValue * 0.004, 1.2) : Math.max(dimValue * 0.008, 1.5)

    const pixelDot = dimValue < 50 ? Math.max(dimValue * 0.004, 0.05) : Math.max(dimValue * 0.008, 0.1)

    const shadowRange = dimValue < 50 ? Math.max(dimValue * 0.004, 0.5) : Math.max(dimValue * 0.008, 2)

    const maskRadius =
        dimValue < 30 ? "0%" : dimValue < 50 ? "5%" : dimValue < 100 ? "15%" : "25%"

    const adjustedContrast =
        dimValue < 30 ? 1.1 : dimValue < 50 ? Math.max(contrastStrength * 1.2, 1.3) : contrastStrength

    return (
        <div
            className={cn("color-orb", className)}
            style={{
                width: dimension,
                height: dimension,
                "--base": palette.base,
                "--accent1": palette.accent1,
                "--accent2": palette.accent2,
                "--accent3": palette.accent3,
                "--spin-duration": `${spinDuration}s`,
                "--blur": `${blurStrength}px`,
                "--contrast": adjustedContrast,
                "--dot": `${pixelDot}px`,
                "--shadow": `${shadowRange}px`,
                "--mask": maskRadius,
            } as React.CSSProperties}
        >
            <style jsx>{`
        @property --angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .color-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
          transform: scale(1.1);
        }

        .color-orb::before,
        .color-orb::after {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          transform: translateZ(0);
        }

        .color-orb::before {
          background:
            conic-gradient(
              from calc(var(--angle) * 2) at 25% 70%,
              var(--accent3),
              transparent 20% 80%,
              var(--accent3)
            ),
            conic-gradient(
              from calc(var(--angle) * 2) at 45% 75%,
              var(--accent2),
              transparent 30% 60%,
              var(--accent2)
            ),
            conic-gradient(
              from calc(var(--angle) * -3) at 80% 20%,
              var(--accent1),
              transparent 40% 60%,
              var(--accent1)
            ),
            conic-gradient(
              from calc(var(--angle) * 2) at 15% 5%,
              var(--accent2),
              transparent 10% 90%,
              var(--accent2)
            ),
            conic-gradient(
              from calc(var(--angle) * 1) at 20% 80%,
              var(--accent1),
              transparent 10% 90%,
              var(--accent1)
            ),
            conic-gradient(
              from calc(var(--angle) * -2) at 85% 10%,
              var(--accent3),
              transparent 20% 80%,
              var(--accent3)
            );
          box-shadow: inset var(--base) 0 0 var(--shadow) calc(var(--shadow) * 0.2);
          filter: blur(var(--blur)) contrast(var(--contrast));
          animation: spin var(--spin-duration) linear infinite;
        }

        .color-orb::after {
          background-image: radial-gradient(
            circle at center,
            var(--base) var(--dot),
            transparent var(--dot)
          );
          background-size: calc(var(--dot) * 2) calc(var(--dot) * 2);
          backdrop-filter: blur(calc(var(--blur) * 2)) contrast(calc(var(--contrast) * 2));
          mix-blend-mode: overlay;
        }

        .color-orb[style*="--mask: 0%"]::after {
          mask-image: none;
        }

        .color-orb:not([style*="--mask: 0%"])::after {
          mask-image: radial-gradient(black var(--mask), transparent 75%);
        }

        @keyframes spin {
          to {
            --angle: 360deg;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .color-orb::before {
            animation: none;
          }
        }
      `}</style>
        </div>
    )
}

const SPEED_FACTOR = 1

interface VoicePanelProps {
    isOpen: boolean
    transcript: string
    status: 'idle' | 'listening' | 'processing' | 'success' | 'error'
    onStart: () => void
    onStop: () => void
    onClose: () => void
    trigger?: React.ReactNode // Allow custom trigger
}

interface ContextShape {
    showForm: boolean
    successFlag: boolean
    triggerOpen: () => void
    triggerClose: () => void
    transcript: string
    status: VoicePanelProps['status']
    onStop: () => void
}

const FormContext = React.createContext({} as ContextShape)
const useFormContext = () => React.useContext(FormContext)

export function MorphPanel({
    isOpen,
    transcript,
    status,
    onStart,
    onStop,
    onClose,
    trigger
}: VoicePanelProps) {
    const wrapperRef = React.useRef<HTMLDivElement>(null)
    const successFlag = status === 'success'
    const showForm = isOpen

    // When clicking outside, close if open
    React.useEffect(() => {
        function clickOutsideHandler(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && showForm) {
                onClose()
            }
        }
        document.addEventListener("mousedown", clickOutsideHandler)
        return () => document.removeEventListener("mousedown", clickOutsideHandler)
    }, [showForm, onClose])

    const ctx = React.useMemo(
        () => ({
            showForm,
            successFlag,
            triggerOpen: onStart,
            triggerClose: onClose,
            transcript,
            status,
            onStop
        }),
        [showForm, successFlag, onStart, onClose, transcript, status, onStop]
    )


    return (
        <FormContext.Provider value={ctx}>
            {/* The Custom Trigger (rendered where expected in parent layout) */}
            {trigger && !showForm && (
                <div onClick={onStart}>{trigger}</div>
            )}

            {/* Default Trigger if none provided */}
            {!trigger && !showForm && (
                <div className="fixed bottom-6 right-6 z-50">
                    <Button onClick={onStart}>Open AI</Button>
                </div>
            )}

            {/* Centered Modal Overlay */}
            <AnimatePresence>
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <motion.div
                            ref={wrapperRef}
                            layoutId="voice-panel" // For smooth expansion if we connected trigger
                            className={cx(
                                "bg-white relative flex flex-col items-center overflow-hidden shadow-2xl"
                            )}
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{
                                width: FORM_WIDTH,
                                height: FORM_HEIGHT,
                                opacity: 1,
                                scale: 1,
                                y: 0,
                                borderRadius: 24,
                            }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{
                                duration: 0.25,
                                ease: [0.4, 0, 0.2, 1], // Smooth ease-in-out
                            }}
                        >
                            <TranscriptDisplay />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </FormContext.Provider>
    )
}

const FORM_WIDTH = 360
const FORM_HEIGHT = 400

function TranscriptDisplay() {
    const { triggerClose, transcript, status, onStop } = useFormContext()

    return (
        <div className="flex h-full w-full flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <ColorOrb
                            dimension="32px"
                            spinDuration={status === 'processing' ? 2 : 10}
                            tones={status === 'processing' ? {
                                base: "oklch(60% 0.15 250)",
                                accent1: "oklch(70% 0.15 300)"
                            } : undefined}
                        />
                        {status === 'listening' && (
                            <motion.div
                                className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                            />
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-base leading-none">AI Assistant</h3>
                        <span className="text-xs font-medium text-gray-500">
                            {status === 'listening' ? 'Listening...' :
                                status === 'processing' ? 'Processing...' :
                                    status === 'success' ? 'Added!' :
                                        status === 'error' ? 'Error' : 'Ready'}
                        </span>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                    onClick={triggerClose}
                >
                    ✕
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50">
                {transcript ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm"
                    >
                        <p className="text-gray-800 font-medium text-lg leading-relaxed whitespace-pre-wrap">
                            "{transcript}"
                        </p>
                    </motion.div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                        <p className="text-sm italic">Start speaking...</p>
                    </div>
                )}
            </div>

            {/* Footer / Controls */}
            <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-2">
                {status === 'listening' ? (
                    <button
                        className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                        onClick={onStop}
                    >
                        <span className="w-2 h-2 rounded-sm bg-white" />
                        Stop Listening
                    </button>
                ) : (
                    <div className="text-xs text-center text-gray-400">
                        Auto-processing enabled
                    </div>
                )}
            </div>
        </div>
    )
}

export default MorphPanel
