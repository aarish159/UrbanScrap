import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  steps: { id: number; title: string; subtitle?: string }[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, onStepClick }) => {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between max-w-2xl mx-auto px-2">
        {steps.map((step, idx) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = onStepClick && isCompleted;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle & Label */}
              <div
                className={`flex flex-col items-center relative ${
                  isClickable ? 'cursor-pointer group' : ''
                }`}
                onClick={() => isClickable && onStepClick(step.id)}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    onStepClick(step.id);
                  }
                }}
                aria-label={`Step ${step.id}: ${step.title}`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-200 border-2 ${
                    isCompleted
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-950/50 group-hover:scale-105'
                      : isCurrent
                      ? 'bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white ring-4 ring-emerald-500/25 shadow-lg shadow-emerald-950/60 scale-105'
                      : 'bg-white/[0.04] border-white/10 text-white/50'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 stroke-[2.8]" />
                  ) : (
                    <span>0{step.id}</span>
                  )}
                </div>

                <div className="mt-2.5 text-center">
                  <span
                    className={`block text-xs sm:text-sm transition-colors ${
                      isCurrent
                        ? 'text-white font-extrabold'
                        : isCompleted
                        ? 'text-emerald-400 font-bold'
                        : 'text-white/50 font-semibold'
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.subtitle && (
                    <span className="hidden sm:block text-[11px] text-emerald-300/40 font-medium mt-0.5">
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 sm:mx-4 -mt-7 rounded-full transition-all duration-300 ${
                    currentStep > idx + 1 ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
