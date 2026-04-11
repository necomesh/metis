package ai

import (
	"github.com/casbin/casbin/v2"
	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/app"
	"metis/internal/app/node"
	"metis/internal/scheduler"
)

func init() {
	app.Register(&AIApp{})
}

type AIApp struct {
	injector do.Injector
}

func (a *AIApp) Name() string { return "ai" }

func (a *AIApp) Models() []any {
	return []any{
		&Provider{}, &AIModel{}, &AILog{},
		&KnowledgeBase{}, &KnowledgeSource{}, &KnowledgeNode{},
		&KnowledgeEdge{}, &KnowledgeLog{},
	}
}

func (a *AIApp) Seed(db *gorm.DB, enforcer *casbin.Enforcer) error {
	return seedAI(db, enforcer)
}

func (a *AIApp) Providers(i do.Injector) {
	a.injector = i
	do.Provide(i, NewProviderRepo)
	do.Provide(i, NewModelRepo)
	do.Provide(i, NewProviderService)
	do.Provide(i, NewModelService)
	do.Provide(i, NewProviderHandler)
	do.Provide(i, NewModelHandler)
	// Knowledge
	do.Provide(i, NewKnowledgeBaseRepo)
	do.Provide(i, NewKnowledgeSourceRepo)
	do.Provide(i, NewKnowledgeNodeRepo)
	do.Provide(i, NewKnowledgeEdgeRepo)
	do.Provide(i, NewKnowledgeBaseService)
	do.Provide(i, NewKnowledgeSourceService)
	do.Provide(i, NewKnowledgeBaseHandler)
	do.Provide(i, NewKnowledgeSourceHandler)
	do.Provide(i, NewKnowledgeNodeHandler)
	do.Provide(i, NewKnowledgeLogRepo)
	do.Provide(i, NewKnowledgeExtractService)
	do.Provide(i, NewKnowledgeCompileService)
	do.Provide(i, NewKnowledgeQueryHandler)
}

func (a *AIApp) Routes(api *gin.RouterGroup) {
	providerH := do.MustInvoke[*ProviderHandler](a.injector)
	modelH := do.MustInvoke[*ModelHandler](a.injector)
	kbH := do.MustInvoke[*KnowledgeBaseHandler](a.injector)
	sourceH := do.MustInvoke[*KnowledgeSourceHandler](a.injector)
	nodeH := do.MustInvoke[*KnowledgeNodeHandler](a.injector)

	providers := api.Group("/ai/providers")
	{
		providers.POST("", providerH.Create)
		providers.GET("", providerH.List)
		providers.GET("/:id", providerH.Get)
		providers.PUT("/:id", providerH.Update)
		providers.DELETE("/:id", providerH.Delete)
		providers.POST("/:id/test", providerH.TestConnection)
		providers.POST("/:id/sync-models", modelH.SyncModels)
	}

	models := api.Group("/ai/models")
	{
		models.POST("", modelH.Create)
		models.GET("", modelH.List)
		models.GET("/:id", modelH.Get)
		models.PUT("/:id", modelH.Update)
		models.DELETE("/:id", modelH.Delete)
		models.PATCH("/:id/default", modelH.SetDefault)
	}

	kbs := api.Group("/ai/knowledge-bases")
	{
		kbs.POST("", kbH.Create)
		kbs.GET("", kbH.List)
		kbs.GET("/:id", kbH.Get)
		kbs.PUT("/:id", kbH.Update)
		kbs.DELETE("/:id", kbH.Delete)
		kbs.POST("/:id/compile", kbH.Compile)
		kbs.POST("/:id/recompile", kbH.Recompile)
		// Sources
		kbs.POST("/:id/sources", sourceH.Create)
		kbs.GET("/:id/sources", sourceH.List)
		kbs.GET("/:id/sources/:sid", sourceH.Get)
		kbs.DELETE("/:id/sources/:sid", sourceH.Delete)
		// Nodes
		kbs.GET("/:id/nodes", nodeH.List)
		kbs.GET("/:id/nodes/:nid", nodeH.Get)
		kbs.GET("/:id/nodes/:nid/graph", nodeH.GetGraph)
		// Logs
		kbs.GET("/:id/logs", nodeH.ListLogs)
	}

	// Agent knowledge query API (Sidecar token auth, bypasses JWT+Casbin)
	queryH := do.MustInvoke[*KnowledgeQueryHandler](a.injector)
	r := do.MustInvoke[*gin.Engine](a.injector)
	nodeRepo := do.MustInvoke[*node.NodeRepo](a.injector)
	knowledge := r.Group("/api/v1/ai/knowledge", node.NodeTokenMiddleware(nodeRepo))
	{
		knowledge.GET("/search", queryH.Search)
		knowledge.GET("/nodes/:id", queryH.GetNode)
		knowledge.GET("/nodes/:id/graph", queryH.GetNodeGraph)
	}
}

func (a *AIApp) Tasks() []scheduler.TaskDef {
	extractSvc := do.MustInvoke[*KnowledgeExtractService](a.injector)
	compileSvc := do.MustInvoke[*KnowledgeCompileService](a.injector)
	var defs []scheduler.TaskDef
	defs = append(defs, extractSvc.TaskDefs()...)
	defs = append(defs, compileSvc.TaskDefs()...)
	return defs
}
