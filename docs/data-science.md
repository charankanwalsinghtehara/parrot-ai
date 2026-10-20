# Data Science and ML

## Clinical screening

Clinical disease-risk prediction is intentionally disabled. No suitable, legitimately sourced and adequately labeled parrot case dataset is included, so there are no claimed training metrics or disease probabilities. The risk-screening endpoint reports the capability as unavailable and returns deterministic emergency guidance where applicable.

## Personal trend review

Weight and care trends use only a bird's own recorded history. Sparse records return an insufficient-history status. Robust median/MAD comparisons are intended to flag measurements worth reviewing, not diagnose disease. Unusual observations are retained and are not automatically deleted. Species-specific universal weight thresholds are not applied.

## Dataset governance

Reference knowledge records require a source URL/title and should be reviewed for clinical accuracy and permitted reuse before production seeding. Any demonstration dataset must identify itself as synthetic in its catalog metadata. Do not populate fake clinical cases or report fabricated evaluation metrics. Training scripts should record dataset version, feature schema, seed, timestamp, evaluation report, approval state and artifact digest before an artifact can be used.

## Future experiments

For an approved labeled dataset, split by bird/patient identity to prevent leakage, report precision/recall/F1 and confusion matrix, assess calibration where relevant, and document class balance and uncertainty. Training remains an offline operation. Deployment should return unavailable when a compatible approved artifact is not present.