import { StyleSheet } from "@react-pdf/renderer";

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#14151A",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  h1: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 16,
    color: "#1F8A8A",
  },
  h2: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 12,
  },
  muted: { color: "#6B6F76", fontSize: 9 },
  line: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(20,21,26,0.08)",
    marginVertical: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "rgba(31,138,138,0.08)",
    padding: 6,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(20,21,26,0.06)",
  },
  colWide: { flex: 2 },
  col: { flex: 1, textAlign: "right" },
  colLeft: { flex: 1 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 24,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#6B6F76",
  },
});
