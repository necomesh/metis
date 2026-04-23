package main

import (
	"context"
	"os"
	"os/signal"
)

func signalNotifyContext(parent context.Context, extra ...os.Signal) (context.Context, context.CancelFunc) {
	signals := append([]os.Signal{os.Interrupt}, extra...)
	return signal.NotifyContext(parent, signals...)
}
