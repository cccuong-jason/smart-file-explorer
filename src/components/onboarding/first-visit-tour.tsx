'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, FolderOpen, Keyboard, ChevronRight, ChevronLeft, Check, Search, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/retroui/Button';

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
      iconColor: 'bg-primary text-primary-foreground',
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
            "flex flex-col overflow-hidden rounded border-2 border-border bg-card text-card-foreground shadow-md",
            StepContent.target ? "w-[340px]" : "w-[380px]",
            internalIsOpen && currentStep === 0 && "animate-in fade-in zoom-in-95 duration-500"
          )}
          style={tooltipStyle}
        >
          {/* Progress Bar inside tooltip */}
           <div className="flex h-1 w-full bg-secondary">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={clsx(
                  "h-full flex-1 transition-all duration-500",
                  idx <= currentStep ? "bg-primary" : "bg-transparent",
                  idx > 0 && "border-l border-border"
                )}
              />
            ))}
          </div>

          {!StepContent.target && (
            // Animated Mockup Area for Global Hotkey Step
            <div className="relative flex h-44 flex-col items-center justify-center overflow-hidden border-b-2 border-border bg-foreground p-6">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_22%,transparent),transparent)]" />
              
              {/* Fake Desktop BG */}
              <div className="w-full h-full absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

              {/* Animated Spotlight Bar */}
              <div className="z-10 flex h-12 w-full max-w-[280px] animate-spotlight-mock items-center gap-3 rounded border-2 border-background bg-card px-4 shadow-md">
                <Search className="h-4 w-4 text-primary" />
                <div className="flex-1 flex gap-1 items-center">
                  <span className="text-white font-medium text-sm animate-pulse tracking-wide inline-block" style={{animationDuration: '2s'}}>
                     yearly report...
                  </span>
                  <div className="h-4 w-0.5 animate-pulse bg-primary" />
                </div>
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>

              {/* Fake Keypress Indication */}
              <div className="absolute bottom-4 flex gap-1.5 z-10" style={{ animation: 'float-up 3s ease-in-out infinite' }}>
                <kbd className="rounded border-2 border-background bg-card px-2.5 py-1 font-mono text-[10px] text-foreground shadow-sm">Ctrl</kbd>
                <kbd className="rounded border-2 border-background bg-card px-2.5 py-1 font-mono text-[10px] text-foreground shadow-sm">Shift</kbd>
                <kbd className="rounded border-2 border-background bg-primary px-4 py-1 font-mono text-[10px] text-primary-foreground shadow-sm">Space</kbd>
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-border shadow-inner", StepContent.iconColor)}>
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="font-head text-lg font-bold leading-tight text-foreground">
                {StepContent.title}
              </h2>
            </div>
            
            <p className="min-h-[60px] text-sm leading-relaxed text-muted-foreground">
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
                    idx === currentStep ? "w-6 bg-primary" : "w-1.5 bg-border"
                  )}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  type="button"
                  onClick={handlePrev}
                  variant="outline"
                  size="sm"
                  className="gap-1 bg-card"
                >
                  <ChevronLeft className="w-4 h-4" /> {t('tour_back')}
                </Button>
              )}
              <Button
                type="button"
                onClick={handleNext}
                size="sm"
                className="gap-2 px-5 py-2.5 text-sm"
              >
                {currentStep < steps.length - 1 ? (
                  <>{t('tour_next')} <ChevronRight className="w-4 h-4 ml-0.5" /></>
                ) : (
                  <>{t('tour_get_started')} <Check className="w-4 h-4 ml-0.5" /></>
                )}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
