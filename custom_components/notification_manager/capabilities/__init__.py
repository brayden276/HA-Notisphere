"""Capability discovery and semantic translation."""

from .ha import HomeAssistantCapabilityDiscovery
from .models import (
    CapabilityTarget,
    ParameterSchema,
    ParameterType,
    ResolvedTrigger,
    Semantic,
    SemanticChoice,
    TargetCategory,
    TargetSnapshot,
)
from .registry import (
    SYNTHETIC_TIME_TARGET,
    CapabilityRegistry,
    CapabilityRegistryError,
    InvalidCapabilityParametersError,
    TargetNotFoundError,
    UnsupportedSemanticError,
    UnsupportedTargetError,
)

__all__ = [
    "SYNTHETIC_TIME_TARGET",
    "CapabilityRegistry",
    "CapabilityRegistryError",
    "CapabilityTarget",
    "HomeAssistantCapabilityDiscovery",
    "InvalidCapabilityParametersError",
    "ParameterSchema",
    "ParameterType",
    "ResolvedTrigger",
    "Semantic",
    "SemanticChoice",
    "TargetCategory",
    "TargetNotFoundError",
    "TargetSnapshot",
    "UnsupportedSemanticError",
    "UnsupportedTargetError",
]
