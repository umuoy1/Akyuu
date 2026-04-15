import { z } from "zod";

import { preferenceProfileSchema } from "../../../domain/preference.js";

export const preferenceProfileResponseSchema = z.object({
  profile: preferenceProfileSchema.nullable()
});

export type PreferenceProfileResponse = z.infer<typeof preferenceProfileResponseSchema>;
