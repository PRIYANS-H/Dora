import math
from typing import Dict, List, Any

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two lat/lng points."""
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def compute_tailor_match(
    tailor: Any, 
    requested_attributes: Dict[str, str], 
    user_lat: float = 37.7749, 
    user_lng: float = -122.4194
) -> Dict[str, Any]:
    """
    Computes explainable tailor match score:
    score = 0.35 * skill_overlap + 0.25 * (1 - norm_dist) + 0.20 * norm_rating + 0.20 * portfolio_overlap
    """
    attr_tags = set(requested_attributes.values())
    
    # 1. Skill overlap (Jaccard similarity)
    tailor_skills = set(tailor.skills or [])
    if attr_tags and tailor_skills:
        # Match attribute tags or synonyms against tailor skills
        matched_skills = [s for s in tailor_skills if any(a.lower() in s.lower() or s.lower() in a.lower() for a in attr_tags)]
        skill_overlap = len(matched_skills) / max(len(attr_tags), 1)
        skill_overlap = min(max(skill_overlap, 0.4), 1.0) # baseline threshold for seeded skill sets
    else:
        skill_overlap = 0.75

    # 2. Distance score (1 - normalized distance over max 30km radius)
    dist_km = haversine_distance(user_lat, user_lng, tailor.lat, tailor.lng)
    max_radius_km = 30.0
    normalized_distance = min(dist_km / max_radius_km, 1.0)
    distance_score = max(0.0, 1.0 - normalized_distance)

    # 3. Rating score (Rating / 5.0)
    rating_score = min(max(tailor.rating / 5.0, 0.0), 1.0)

    # 4. Portfolio tag overlap
    portfolio_tags = set(tailor.portfolio_tags or [])
    if attr_tags and portfolio_tags:
        matched_portfolio = [p for p in portfolio_tags if any(a.lower() in p.lower() or p.lower() in a.lower() for a in attr_tags)]
        portfolio_overlap = len(matched_portfolio) / max(len(attr_tags), 1)
        portfolio_overlap = min(max(portfolio_overlap, 0.5), 1.0)
    else:
        portfolio_overlap = 0.70

    # Weighted Total Score
    total_score = (
        0.35 * skill_overlap +
        0.25 * distance_score +
        0.20 * rating_score +
        0.20 * portfolio_overlap
    )

    return {
        "match_score": round(total_score * 100, 1),
        "breakdown": {
            "skill_overlap": round(skill_overlap * 100, 1),
            "distance_score": round(distance_score * 100, 1),
            "rating_score": round(rating_score * 100, 1),
            "portfolio_overlap": round(portfolio_overlap * 100, 1)
        }
    }
