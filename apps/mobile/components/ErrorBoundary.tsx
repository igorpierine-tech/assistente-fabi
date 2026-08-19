import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const info = this.state.errorInfo;

      return (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>Erro no app</Text>
          <Text style={styles.label}>Mensagem:</Text>
          <Text style={styles.message} selectable>
            {error?.message || "Erro desconhecido"}
          </Text>

          {error?.name ? (
            <>
              <Text style={styles.label}>Tipo:</Text>
              <Text style={styles.message} selectable>{error.name}</Text>
            </>
          ) : null}

          {error?.stack ? (
            <>
              <Text style={styles.label}>Stack trace:</Text>
              <Text style={styles.stack} selectable>{error.stack}</Text>
            </>
          ) : null}

          {info?.componentStack ? (
            <>
              <Text style={styles.label}>Component stack:</Text>
              <Text style={styles.stack} selectable>{info.componentStack}</Text>
            </>
          ) : null}

          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FBF8F3" },
  content: { padding: 24, paddingTop: 60 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#C75050",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: "#8B8078",
    marginTop: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  message: {
    fontSize: 15,
    color: "#2C2418",
    marginTop: 4,
    fontFamily: "monospace",
  },
  stack: {
    fontSize: 11,
    color: "#5E4B37",
    marginTop: 4,
    fontFamily: "monospace",
    lineHeight: 16,
  },
  btn: {
    marginTop: 32,
    backgroundColor: "#5E4B37",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#FFFFFF", fontWeight: "600" },
});
