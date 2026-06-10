# Tasks

## 1. Data model

- [x] 1.1 Add `line_items.smoothing_profile` (enum: uniform | traffic-weighted | day-part)
- [x] 1.2 Add `line_items.day_part_window` (nullable JSONB)
- [x] 1.3 Add `expected_spend_curves` daily-partitioned table

## 2. Curve builder

- [x] 2.1 Stand up the `pacing-curve-builder` daily batch job
- [x] 2.2 Implement the 14-day traffic-weighted curve calculation
- [ ] 2.3 Implement the day-part curve calculation
- [ ] 2.4 Fallback to `uniform` on insufficient history

## 3. Pacing service

- [x] 3.1 Replace the uniform-distribution expected-spend computation with the curve lookup
- [x] 3.2 Confirm the 60s posture-update SLO is preserved
- [ ] 3.3 Add the `outside_day_part` observed-spend flag

## 4. Brand API surface

- [x] 4.1 Extend the line-item PATCH endpoint with `smoothing_profile`
- [ ] 4.2 Validation: day_part_window is required iff smoothing_profile is `day-part`
- [ ] 4.3 Default new line-items to `traffic-weighted`

## 5. Validation

- [ ] 5.1 Synthetic-traffic test on a peak-window retailer profile
- [ ] 5.2 Day-part test confirming zero spend outside the configured hours
- [ ] 5.3 Co-ordinate with `rename-stop-overspend-requirement` so the updated reference lands cleanly
