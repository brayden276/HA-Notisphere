"""Rule health, stable-reference repair and reconciliation entrypoints."""

from .coordinator import HomeAssistantRuleHealthCoordinator
from .ha import HomeAssistantRuleHealthAdapter
from .models import (
    HealthEntitySnapshot,
    HealthReconciliationReport,
    HealthUserSnapshot,
    RuleHealthSnapshot,
)
from .reconciler import RuleHealthReconciler
from .service import RuleHealthReconciliationService

__all__ = [
    "HealthEntitySnapshot",
    "HealthReconciliationReport",
    "HealthUserSnapshot",
    "HomeAssistantRuleHealthAdapter",
    "HomeAssistantRuleHealthCoordinator",
    "RuleHealthReconciler",
    "RuleHealthReconciliationService",
    "RuleHealthSnapshot",
]
