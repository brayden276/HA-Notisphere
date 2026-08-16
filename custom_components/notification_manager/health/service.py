"""Optimistic persistence orchestration for pure rule health reconciliation."""

from __future__ import annotations

from ..storage import RevisionConflictError, RuleNotFoundError, RuleRepository
from .models import HealthReconciliationReport, RuleHealthSnapshot
from .reconciler import RuleHealthReconciler


class RuleHealthReconciliationService:
    """Reconcile stored rules without overwriting concurrent editor changes."""

    def __init__(
        self,
        repository: RuleRepository,
        reconciler: RuleHealthReconciler | None = None,
        *,
        conflict_retries: int = 2,
    ) -> None:
        if conflict_retries < 0:
            raise ValueError("Conflict retries cannot be negative")
        self._repository = repository
        self._reconciler = reconciler or RuleHealthReconciler()
        self._conflict_retries = conflict_retries

    async def async_reconcile(
        self, snapshot: RuleHealthSnapshot
    ) -> HealthReconciliationReport:
        rule_ids = tuple(rule.id for rule in await self._repository.list())
        updated = []
        unchanged: list[str] = []
        conflicted: list[str] = []
        deleted: list[str] = []

        for rule_id in rule_ids:
            for attempt in range(self._conflict_retries + 1):
                current = await self._repository.get(rule_id)
                if current is None:
                    deleted.append(rule_id)
                    break
                desired = self._reconciler.reconcile(current, snapshot)
                if desired == current:
                    unchanged.append(rule_id)
                    break
                try:
                    saved = await self._repository.update(
                        desired, expected_revision=current.revision
                    )
                except RuleNotFoundError:
                    deleted.append(rule_id)
                    break
                except RevisionConflictError:
                    if attempt == self._conflict_retries:
                        conflicted.append(rule_id)
                    continue
                updated.append(saved)
                break

        return HealthReconciliationReport(
            tuple(updated),
            tuple(unchanged),
            tuple(conflicted),
            tuple(deleted),
        )


__all__ = ["RuleHealthReconciliationService"]
