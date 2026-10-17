import React, { useState, useRef } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";

const STANDARD_BUTTONS = [
  ["√", "x²", "1/x", "ANS"],
  ["AC", "DEL", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["±", "0", ".", "="],
];

const SCIENTIFIC_BUTTONS = [
  ["sin", "cos", "tan", "π"],
  ["log", "ln", "(", ")"],
  ["√", "x²", "1/x", "ANS"],
  ["AC", "DEL", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["±", "0", ".", "="],
];

const OPERATORS = {
  "÷": "/",
  "×": "*",
  "−": "-",
  "+": "+",
};

// Safe arithmetic parser extended for scientific functions
function evaluateExpression(input) {
  // Pre-process scientific functions or replace constants if needed
  let processedInput = input
    .replace(/π/g, Math.PI)
    .replace(/sin\(/g, "Math.sin(")
    .replace(/cos\(/g, "Math.cos(")
    .replace(/tan\(/g, "Math.tan(")
    .replace(/log\(/g, "Math.log10(")
    .replace(/ln\(/g, "Math.log(");

  const tokens = processedInput.match(/Math\.\w+|\d*\.?\d+|[+\-*/()]/g);

  if (!tokens) {
    throw new Error("Invalid expression");
  }

  let index = 0;

  function expression() {
    let value = term();

    while (tokens[index] === "+" || tokens[index] === "-") {
      const op = tokens[index++];
      const right = term();
      value = op === "+" ? value + right : value - right;
    }

    return value;
  }

  function term() {
    let value = factor();

    while (tokens[index] === "*" || tokens[index] === "/") {
      const op = tokens[index++];
      const right = factor();

      if (op === "/" && right === 0) {
        throw new Error("Division by zero");
      }

      value = op === "*" ? value * right : value / right;
    }

    return value;
  }

  function factor() {
    const token = tokens[index];

    if (!token) throw new Error("Unexpected end of expression");

    if (token.startsWith("Math.")) {
      const funcName = token;
      index++;
      if (tokens[index] !== "(") throw new Error("Missing parenthesis after function");
      index++; // skip '('
      const val = expression();
      if (tokens[index] !== ")") throw new Error("Missing closing parenthesis");
      index++; // skip ')'

      switch (funcName) {
        case "Math.sin": return Math.sin(val);
        case "Math.cos": return Math.cos(val);
        case "Math.tan": return Math.tan(val);
        case "Math.log10": return Math.log10(val);
        case "Math.log": return Math.log(val);
        default: throw new Error("Unknown function");
      }
    }

    if (token === "+") {
      index++;
      return factor();
    }

    if (token === "-") {
      index++;
      return -factor();
    }

    if (token === "(") {
      index++;
      const value = expression();

      if (tokens[index] !== ")") {
        throw new Error("Missing closing parenthesis");
      }

      index++;
      return value;
    }

    if (!/^\d*\.?\d+$/.test(token)) {
      throw new Error("Invalid number");
    }

    index++;
    return Number(token);
  }

  const result = expression();

  if (index !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Invalid result");
  }

  return result;
}

function cleanNumber(value) {
  return String(Math.round(value * 1e10) / 1e10);
}

export default function App() {
  const [equation, setEquation] = useState("0");
  const [evaluated, setEvaluated] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("0");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isScientific, setIsScientific] = useState(false);
  const scrollRef = useRef(null);

  const formatDisplay = (expr) => {
    if (expr === "Error") return expr;

    return expr
      .replace(/\*/g, "×")
      .replace(/\//g, "÷")
      .replace(/-/g, "−");
  };

  const addToHistory = (expr, result) => {
    setHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        expression: formatDisplay(expr),
        result: cleanNumber(result),
      },
      ...prev,
    ]);
  };

  const clear = () => {
    setEquation("0");
    setEvaluated(false);
  };

  const deleteDigit = () => {
    if (evaluated || equation === "Error") {
      clear();
      return;
    }

    setEquation((prev) =>
      prev.length <= 1 ? "0" : prev.slice(0, -1)
    );
  };

  const appendDigit = (num) => {
    if (evaluated || equation === "Error") {
      setEquation(num === "." ? "0." : num);
      setEvaluated(false);
      return;
    }

    setEquation((prev) => {
      if (num === ".") {
        const currentNumber = prev.split(/[+\-*/()]/).pop();
        if (currentNumber.includes(".")) return prev;
        return prev + ".";
      }

      if (prev === "0" && num !== ".") return num;

      return prev + num;
    });
  };

  const chooseOp = (op) => {
    if (equation === "Error") return;

    setEvaluated(false);

    setEquation((prev) => {
      if (prev === "0" && op !== "-") return prev + op;
      return prev + op;
    });
  };

  const applyScientificFunc = (func) => {
    if (equation === "Error") return;
    setEvaluated(false);

    setEquation((prev) => {
      if (prev === "0") {
        return `${func}(`;
      }
      return prev + `${func}(`;
    });
  };

  const applyUnary = (operation) => {
    if (equation === "Error") return;

    try {
      let expr = equation;
      const value = evaluateExpression(expr);
      let result;

      switch (operation) {
        case "%":
          result = value / 100;
          break;
        case "±":
          result = -value;
          break;
        case "√":
          if (value < 0) throw new Error("Invalid square root");
          result = Math.sqrt(value);
          break;
        case "x²":
          result = value * value;
          break;
        case "1/x":
          if (value === 0) throw new Error("Division by zero");
          result = 1 / value;
          break;
        case "π":
          result = Math.PI;
          break;
        default:
          return;
      }

      if (!Number.isFinite(result)) {
        throw new Error("Invalid result");
      }

      result = cleanNumber(result);
      addToHistory(
        operation === "√" ? `√(${expr})` :
        operation === "x²" ? `${expr}²` :
        operation === "1/x" ? `1/(${expr})` :
        operation === "±" ? `-(${expr})` :
        `${expr}%`,
        result
      );

      setEquation(result);
      setLastAnswer(result);
      setEvaluated(true);
    } catch {
      setEquation("Error");
      setEvaluated(true);
    }
  };

  const compute = () => {
    if (equation === "Error") return;

    try {
      let expr = equation;
      const result = cleanNumber(evaluateExpression(expr));

      addToHistory(equation, result);
      setEquation(result);
      setLastAnswer(result);
      setEvaluated(true);
    } catch {
      setEquation("Error");
      setEvaluated(true);
    }
  };

  const appendAns = () => {
    if (evaluated || equation === "Error" || equation === "0") {
      setEquation(lastAnswer);
      setEvaluated(false);
    } else {
      setEquation((prev) => prev + lastAnswer);
    }
  };

  const handlePress = (label) => {
    if (label === "AC") clear();
    else if (label === "DEL") deleteDigit();
    else if (label === "=") compute();
    else if (label === "ANS") appendAns();
    else if (["sin", "cos", "tan", "log", "ln"].includes(label)) {
      applyScientificFunc(label);
    } else if (label === "π") {
      appendDigit(String(Math.PI));
    } else if (["%", "±", "√", "x²", "1/x"].includes(label)) {
      applyUnary(label);
    } else if (OPERATORS[label]) {
      chooseOp(OPERATORS[label]);
    } else {
      appendDigit(label);
    }
  };

  const buttonStyle = (label) => {
    if (label === "=") return styles.equalsButton;
    if (["AC", "DEL", "ANS"].includes(label)) return styles.actionButton;
    if (["√", "x²", "1/x", "sin", "cos", "tan", "log", "ln", "π"].includes(label)) return styles.scientificButton;
    if (OPERATORS[label]) return styles.operatorButton;
    if (["%", "±", "(", ")"].includes(label)) return styles.utilityButton;
    return styles.numberButton;
  };

  const buttonTextStyle = (label) => {
    if (label === "=") return styles.equalsText;
    if (["AC", "DEL", "ANS"].includes(label)) return styles.actionText;
    if (OPERATORS[label]) return styles.operatorText;
    if (["√", "x²", "1/x", "sin", "cos", "tan", "log", "ln", "π"].includes(label)) return styles.scientificText;
    if (["%", "±", "(", ")"].includes(label)) return styles.utilityText;
    return styles.numberText;
  };

  const activeButtons = isScientific ? SCIENTIFIC_BUTTONS : STANDARD_BUTTONS;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#160D2B" />

      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <View style={styles.orbThree} />

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>ƒ</Text>
              </View>

              <View>
                <Text style={styles.title}>CALCULATOR</Text>
                <Text style={styles.subtitle}>{isScientific ? "SCIENTIFIC MODE" : "STANDARD MODE"}</Text>
              </View>
            </View>

            <View style={styles.headerButtons}>
              {/* Scientific Toggle Button */}
              <TouchableOpacity
                style={[styles.historyButton, isScientific && styles.activeSciButton]}
                onPress={() => setIsScientific(!isScientific)}
                accessibilityRole="button"
              >
                <Text style={styles.historyButtonText}>{isScientific ? "Standard" : "Sci"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => setShowHistory(true)}
                accessibilityRole="button"
              >
                <Text style={styles.historyButtonText}>◷</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.display}>
            <View style={styles.displayHeader}>
              <Text style={styles.displayLabel}>
                {evaluated ? "RESULT" : "ENTER EXPRESSION"}
              </Text>
              <Text style={styles.ready}>● READY</Text>
            </View>

            <ScrollView
              horizontal
              ref={scrollRef}
              showsHorizontalScrollIndicator={false}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
              contentContainerStyle={styles.displayScroll}
            >
              <Text
                style={[
                  styles.result,
                  { fontSize: equation.length > 15 ? 22 : 36 },
                  evaluated && styles.finalResult,
                  equation === "Error" && styles.errorResult,
                ]}
                numberOfLines={1}
              >
                {formatDisplay(equation)}
              </Text>
            </ScrollView>

            <View style={styles.answerRow}>
              <View style={styles.answerLine} />
              <Text style={styles.answerText}>
                ANS: {formatDisplay(lastAnswer)}
              </Text>
            </View>
          </View>

          <View style={styles.keypad}>
            {activeButtons.map((row, rowIndex) => (
              <View style={styles.buttonRow} key={rowIndex}>
                {row.map((label, index) => (
                  <TouchableOpacity
                    key={label + index}
                    activeOpacity={0.65}
                    onPress={() => handlePress(label)}
                    accessibilityRole="button"
                    style={[
                      styles.button,
                      { height: isScientific ? 46 : 54 },
                      index !== row.length - 1 && styles.buttonSpacing,
                      buttonStyle(label),
                    ]}
                  >
                    <Text style={[styles.buttonText, buttonTextStyle(label)]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>PURPLE GLASS EDITION</Text>
            <View style={styles.footerLine} />
          </View>
        </View>
      </View>

      {/* History Modal remains the same */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>YOUR CALCULATIONS</Text>
                <Text style={styles.modalTitle}>History</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowHistory(false)}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyIcon}>◷</Text>
                <Text style={styles.emptyTitle}>No calculations yet</Text>
                <Text style={styles.emptyText}>Your calculations will appear here.</Text>
              </View>
            ) : (
              <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.historyList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyItem}
                    onPress={() => {
                      setEquation(item.result);
                      setLastAnswer(item.result);
                      setEvaluated(true);
                      setShowHistory(false);
                    }}
                    onLongPress={() => {
                      setHistory((prev) => prev.filter((h) => h.id !== item.id));
                    }}
                  >
                    <Text style={styles.historyExpr}>{item.expression}</Text>
                    <Text style={styles.historyResult}>= {formatDisplay(item.result)}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            {history.length > 0 && (
              <TouchableOpacity
                style={styles.clearHistoryButton}
                onPress={() => setHistory([])}
              >
                <Text style={styles.clearHistoryText}>Clear All History</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShowHistory(false)}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#080D18",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
  },
  orbOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#2563EB",
    opacity: 0.18,
    top: -70,
    right: -90,
  },
  orbTwo: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "#0EA5E9",
    opacity: 0.13,
    bottom: -40,
    left: -90,
  },
  orbThree: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#38BDF8",
    opacity: 0.08,
    top: "40%",
    right: -90,
  },
  content: {
    width: "100%",
    maxWidth: 426,
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#263449",
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1E3A8A",
    borderWidth: 1,
    borderColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  logoText: {
    color: "#60A5FA",
    fontSize: 24,
    fontWeight: "800",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 2,
  },
  historyButton: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  activeSciButton: {
    backgroundColor: "#2563EB",
    borderColor: "#60A5FA",
  },
  historyButtonText: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "700",
  },
  display: {
    minHeight: 120,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E3A5F",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    overflow: "hidden",
  },
  displayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  displayLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  ready: {
    color: "#22C55E",
    fontSize: 9,
    fontWeight: "700",
  },
  displayScroll: {
    flexGrow: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  result: {
    color: "#F8FAFC",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  finalResult: {
    color: "#38BDF8",
    fontWeight: "800",
  },
  errorResult: {
    color: "#FB7185",
  },
  answerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  answerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1E293B",
    marginRight: 8,
  },
  answerText: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "600",
  },
  keypad: {},
  buttonRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonSpacing: {
    marginRight: 8,
  },
  numberButton: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
  },
  utilityButton: {
    backgroundColor: "#172554",
    borderColor: "#1D4ED8",
  },
  actionButton: {
    backgroundColor: "#1E3A8A",
    borderColor: "#2563EB",
  },
  scientificButton: {
    backgroundColor: "#0F2747",
    borderColor: "#1E40AF",
  },
  operatorButton: {
    backgroundColor: "#1D4ED8",
    borderColor: "#3B82F6",
  },
  equalsButton: {
    backgroundColor: "#059669",
    borderColor: "#10B981",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  numberText: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "600",
  },
  utilityText: {
    color: "#93C5FD",
    fontSize: 15,
    fontWeight: "700",
  },
  actionText: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "700",
  },
  scientificText: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
  },
  operatorText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  equalsText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#334155",
  },
  footerText: {
    color: "#64748B",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: "80%",
    minHeight: 330,
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#475569",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalEyebrow: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 17,
    color: "#60A5FA",
    fontWeight: "750",
  },
  emptyHistory: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyIcon: {
    color: "#3B82F6",
    fontSize: 38,
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 7,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
  },
  historyList: {
    paddingBottom: 8,
  },
  historyItem: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  historyExpr: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "right",
    marginBottom: 8,
  },
  historyResult: {
    color: "#38BDF8",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "right",
  },
  clearHistoryButton: {
    marginTop: 8,
    backgroundColor: "#450A0A",
    borderWidth: 1,
    borderColor: "#991B1B",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  clearHistoryText: {
    F87171: "#F87171",
    color: "#F87171",
    fontWeight: "700",
    fontSize: 13,
  },
  doneButton: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: "#3B82F6",
    padding: 14,
    borderRadius: 15,
    alignItems: "center",
  },
  doneText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});