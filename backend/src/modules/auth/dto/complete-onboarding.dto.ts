import { z } from "zod";

const TrimmedNonEmptyString = z.string().trim().min(1);

export const CompleteOnboardingDtoSchema = z.object({
  full_name: TrimmedNonEmptyString.max(180),
  phone_number: TrimmedNonEmptyString.max(40),
  country: TrimmedNonEmptyString.max(120),
  timezone: TrimmedNonEmptyString.max(120),
  company_name: z.string().trim().max(180).optional().default("Personal")
});

export type CompleteOnboardingDto = z.infer<typeof CompleteOnboardingDtoSchema>;
