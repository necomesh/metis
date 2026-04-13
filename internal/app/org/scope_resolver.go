package org

// OrgScopeResolverImpl implements app.OrgScopeResolver backed by AssignmentService.
type OrgScopeResolverImpl struct {
	svc *AssignmentService
}

// GetUserDeptScope returns department IDs visible to the user.
// If includeSubDepts is true, BFS-expands to active sub-departments.
func (r *OrgScopeResolverImpl) GetUserDeptScope(userID uint, includeSubDepts bool) ([]uint, error) {
	if includeSubDepts {
		return r.svc.GetUserDepartmentScope(userID)
	}
	return r.svc.GetUserDepartmentIDs(userID)
}
