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
                      ? 'bg-[#16a34a] border-[#16a34a] text-white shadow-md shadow-[#16a34a]/25 group-hover:scale-105'
                      : isCurrent
                      ? 'bg-[#123b26] border-[#123b26] text-white ring-4 ring-[#16a34a]/25 shadow-lg scale-105'
                      : 'bg-white border-[#d1d5db] text-[#717a75]'
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
                        ? 'text-[#123b26] font-extrabold'
                        : isCompleted
                        ? 'text-[#16a34a] font-bold'
                        : 'text-[#717a75] font-semibold'
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.subtitle && (
                    <span className="hidden sm:block text-[11px] text-[#9aa19d] font-medium mt-0.5">
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 sm:mx-4 -mt-7 rounded-full transition-all duration-300 ${
                    currentStep > idx + 1 ? 'bg-[#16a34a]' : 'bg-[#e2e4e1]'
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
