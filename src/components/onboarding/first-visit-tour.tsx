'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, FolderOpen, Keyboard, ChevronRight, ChevronLeft, Check, Search, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '@/lib/i18n';

const ONBOARDING_KEY = 'sfe_onboarded';

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export function FirstVisitTour({ isOpen: controlledIsOpen, onClose }: Props) {
  const { t } = useTranslation();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const steps = useMemo(() => [
    {
      id: 'scan',
      target: '[data-tour="scan-btn"]',
      tooltipPlacement: 'right',
      icon: FolderOpen,
      iconColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-200',
      title: t('tour_scan_title'),
      description: t('tour_scan_description')
    },
    {
      id: 'search',
      target: '[data-tour="search-bar"]',
      tooltipPlacement: 'bottom',
      icon: Search,
      iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200',
      title: t('tour_search_title'),
      description: t('tour_search_description')
    },
    {
      id: 'settings',
      target: '[data-tour="settings-btn"]',
      tooltipPlacement: 'right-above',
      icon: Shield,
      iconColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-100',
      title: t('tour_settings_title'),
      description: t('tour_settings_description')
    },
    {
      id: 'hotkey',
      target: null,
      tooltipPlacement: 'center',
      icon: Keyboard,
      iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-200',
      title: t('tour_hotkey_title'),
      description: t('tour_hotkey_description')
    }
  ] as const, [t]);

  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  // Measure the target element's position on screen
  const updateRect = useCallback(() => {
    const step = steps[currentStep];
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null); // Fallback to center if element not found
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep, steps]);

  useEffect(() => {
    if (isVisible) {
      setCurrentStep(0);
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible) {
       updateRect();
    }
  }, [currentStep, isVisible, updateRect]);

  useEffect(() => {
    // Check if onboarded with a short delay
    const timer = setTimeout(() => {
      const hasOnboarded = localStorage.getItem(ONBOARDING_KEY);
      if (!hasOnboarded) {
        setInternalIsOpen(true);
        updateRect(); // Initial measurement setup
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [updateRect]);

  // Recalculate if window resizes during tour
  useEffect(() => {
    if (!isVisible) return;
    window.addEventListener('resize', updateRect);
    // Observe DOM changes occasionally for dynamic UI shifts
    const observer = new ResizeObserver(updateRect);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
    };
  }, [isVisible, updateRect]);

  // Force an update when step changes just in case
  useEffect(() => {
    if (isVisible) {
      setTimeout(updateRect, 100); // Wait for transition if needed
    }
  }, [currentStep, isVisible, updateRect]);

  if (!isVisible) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishOnboarding();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setInternalIsOpen(false);
    onClose?.();
  };

  const StepContent = steps[currentStep];
  const Icon = StepContent.icon;

  // Calculate Tooltip position based on placement request
  let tooltipStyle: React.CSSProperties = {};

  if (targetRect && StepContent.tooltipPlacement === 'right') {
    tooltipStyle = {
      top: targetRect.top,
      left: targetRect.right + 24,
    };
  } else if (targetRect && StepContent.tooltipPlacement === 'right-above') {
    // Anchor bottom of tooltip to the bottom of the target
    tooltipStyle = {
      bottom: window.innerHeight - targetRect.bottom,
      left: targetRect.right + 24,
    };
  } else if (targetRect && StepContent.tooltipPlacement === 'bottom') {
    tooltipStyle = {
      top: targetRect.bottom + 24,
      left: targetRect.left + (targetRect.width / 2) - 160,
    };
  } else {
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // Calculate the Box Shadow Mask (Cutout)
  // If targetRect exists, we position the invisible div over it and cast a massive shadow.
  // If no targetRect, we cast a shadow over everything.
  const maskStyle: React.CSSProperties = targetRect
    ? {
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
        borderRadius: '8px',
      }
    : {
        top: '50%',
        left: '50%',
        width: 0,
        height: 0,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
        borderRadius: '50%', // Circle transition when closing to center
      };

  return (
    <>
      <style>{`
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes spotlight-mockup {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          20% { opacity: 1; transform: scale(1) translateY(0); }
          80% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(-10px); }
        }
        @keyframes type-mockup {
          0%, 30% { opacity: 0; }
          40%, 100% { opacity: 1; }
        }
        .animate-spotlight-mock {
          animation: spotlight-mockup 4s ease-in-out infinite;
        }
      `}</style>
      
      <div className="fixed inset-0 z-[200] overflow-hidden pointer-events-auto">
        
        {/* Cutout Mask */}
        <div
          className="absolute pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={maskStyle}
        />

        {/* Dynamic Tooltip */}
        <div
          className={clsx(
            "absolute transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]",
            "bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col border border-white/40 dark:border-gray-800",
            StepContent.target ? "w-[340px]" : "w-[380px]",
            internalIsOpen && currentStep === 0 && "animate-in fade-in zoom-in-95 duration-500"
          )}
          style={tooltipStyle}
        >
          {/* Progress Bar inside tooltip */}
           <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 flex">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={clsx(
                  "h-full flex-1 transition-all duration-500",
                  idx <= currentStep ? "bg-indigo-500" : "bg-transparent",
                  idx > 0 && "border-l border-white"
                )}
              />
            ))}
          </div>

          {!StepContent.target && (
            // Animated Mockup Area for Global Hotkey Step
            <div className="h-44 bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden p-6 border-b border-gray-100 dark:border-gray-800">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10" />
              
              {/* Fake Desktop BG */}
              <div className="w-full h-full absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

              {/* Animated Spotlight Bar */}
              <div className="z-10 w-full max-w-[280px] h-12 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl flex items-center px-4 gap-3 animate-spotlight-mock">
                <Search className="w-4 h-4 text-indigo-300" />
                <div className="flex-1 flex gap-1 items-center">
                  <span className="text-white font-medium text-sm animate-pulse tracking-wide inline-block" style={{animationDuration: '2s'}}>
                     yearly report...
                  </span>
                  <div className="h-4 w-0.5 bg-indigo-400 animate-pulse" />
                </div>
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>

              {/* Fake Keypress Indication */}
              <div className="absolute bottom-4 flex gap-1.5 z-10" style={{ animation: 'float-up 3s ease-in-out infinite' }}>
                <kbd className="px-2.5 py-1 bg-white/10 backdrop-blur-sm text-gray-200 rounded border border-white/20 text-[10px] font-mono shadow-sm">Ctrl</kbd>
                <kbd className="px-2.5 py-1 bg-white/10 backdrop-blur-sm text-gray-200 rounded border border-white/20 text-[10px] font-mono shadow-sm">Shift</kbd>
                <kbd className="px-4 py-1 bg-indigo-500/30 backdrop-blur-sm text-indigo-100 rounded border border-indigo-400/40 text-[10px] font-mono shadow-sm">Space</kbd>
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner", StepContent.iconColor)}>
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {StepContent.title}
              </h2>
            </div>
            
            <p className="text-gray-500 dark:text-gray-300 text-sm leading-relaxed min-h-[60px]">
              {StepContent.description}
            </p>
          </div>

          <div className="p-5 pt-0 flex items-center justify-between gap-4 mt-auto">
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={clsx(
                    "h-1.5 rounded-full transition-all duration-300",
                    idx === currentStep ? "w-6 bg-indigo-500" : "w-1.5 bg-gray-200"
                  )}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-semibold transition-all duration-200 text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> {t('tour_back')}
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg shadow-md font-bold transition-all duration-200 text-sm"
              >
                {currentStep < steps.length - 1 ? (
                  <>{t('tour_next')} <ChevronRight className="w-4 h-4 ml-0.5" /></>
                ) : (
                  <>{t('tour_get_started')} <Check className="w-4 h-4 ml-0.5" /></>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
