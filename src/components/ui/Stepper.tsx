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
      <div className="flex items-center justify-between max-w-2xl mx-auto">
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
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 border-2 ${
                    isCompleted
                      ? 'bg-[#16a34a] border-[#16a34a] text-white shadow-sm shadow-[#16a34a]/30'
                      : isCurrent
                      ? 'bg-[#143e29] border-[#143e29] text-white ring-4 ring-[#16a34a]/20 shadow-md'
                      : 'bg-white border-[#d1d5db] text-[#717a75]'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : step.id}
                </div>
                <div className="mt-2 text-center">
                  <span
                    className={`block text-xs sm:text-sm font-semibold transition-colors ${
                      isCurrent
                        ? 'text-[#143e29] font-bold'
                        : isCompleted
                        ? 'text-[#16a34a]'
                        : 'text-[#717a75]'
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.subtitle && (
                    <span className="hidden sm:block text-[11px] text-[#9aa19d]">
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-4 -mt-6 transition-all duration-300 ${
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
