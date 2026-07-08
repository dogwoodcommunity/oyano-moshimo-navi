import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getSupabase } from "@/lib/supabase";
import { colors, radius, shadow } from "@/lib/theme";

type AssetCategory = {
  id?: string;
  key: string;
  label: string;
};

type AssetItem = {
  id: string;
  title: string;
  existence_status: string;
  location_note: string | null;
  owner_note: string | null;
  asset_categories?: { label?: string | null } | null;
};

const fallbackCategories: AssetCategory[] = [
  { key: "insurance", label: "保険" },
  { key: "bank", label: "銀行" },
  { key: "important_documents", label: "重要書類" },
  { key: "real_estate", label: "不動産" },
  { key: "pension", label: "年金" },
  { key: "digital", label: "デジタル" },
  { key: "home", label: "実家" }
];

const statusOptions = [
  { key: "exists", label: "ある" },
  { key: "unknown", label: "不明" },
  { key: "not_exists", label: "ない" }
];

function statusLabel(status: string) {
  return statusOptions.find((option) => option.key === status)?.label ?? "不明";
}

export default function AssetsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [categories, setCategories] = useState<AssetCategory[]>(fallbackCategories);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("insurance");
  const [existenceStatus, setExistenceStatus] = useState("exists");
  const [title, setTitle] = useState("保険証券");
  const [location, setLocation] = useState("実家の茶色い棚");
  const [ownerNote, setOwnerNote] = useState("");
  const [items, setItems] = useState<AssetItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadCategories();
    void loadItems();
  }, [params.id]);

  async function loadCategories() {
    const client = getSupabase();
    if (!client) return;

    const { data } = await client
      .from("asset_categories")
      .select("id, key, label")
      .order("label", { ascending: true });

    if (data?.length) setCategories(data as AssetCategory[]);
  }

  async function loadItems() {
    const client = getSupabase();
    if (!client) return;

    const { data } = await client
      .from("asset_items")
      .select("id, title, existence_status, location_note, owner_note, asset_categories(label)")
      .eq("person_id", params.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setItems((data ?? []) as AssetItem[]);
  }

  async function save() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setMessage("項目名を入力してください。");
      return;
    }

    setSaving(true);
    const client = getSupabase();
    if (client) {
      const category = categories.find((item) => item.key === selectedCategoryKey);
      const { error } = await client.from("asset_items").insert({
        person_id: params.id,
        category_id: category?.id ?? null,
        title: trimmedTitle,
        existence_status: existenceStatus,
        location_note: location.trim() || null,
        owner_note: ownerNote.trim() || null
      });

      if (error) {
        setSaving(false);
        setMessage(`保存できませんでした: ${error.message}`);
        return;
      }

      await loadItems();
    }

    setSaving(false);
    setMessage("存在と保管場所を保存しました。暗証番号・パスワードは保存対象外です。");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.kicker}>情報登録</Text>
        <Text style={styles.title}>存在と保管場所だけ残す</Text>
        <Text style={styles.body}>通帳、保険証券、実印、権利書などの「ある/ない/場所」を家族で確認できるようにします。</Text>
      </View>

      <View style={styles.warningBox}>
        <MaterialCommunityIcons color={colors.gold} name="shield-alert-outline" size={24} />
        <Text style={styles.warningText}>銀行暗証番号、各種パスワード、マイナンバー画像、本人確認書類の画像は保存しないでください。</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="file-document-edit-outline" size={22} />
          <Text style={styles.cardTitle}>項目を追加する</Text>
        </View>

        <Text style={styles.label}>カテゴリ</Text>
        <View style={styles.chips}>
          {categories.map((category) => (
            <Pressable
              key={category.key}
              onPress={() => setSelectedCategoryKey(category.key)}
              style={selectedCategoryKey === category.key ? styles.chipActive : styles.chip}
            >
              <Text style={selectedCategoryKey === category.key ? styles.chipActiveText : styles.chipText}>{category.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>有無</Text>
        <View style={styles.chips}>
          {statusOptions.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setExistenceStatus(option.key)}
              style={existenceStatus === option.key ? styles.chipActive : styles.chip}
            >
              <Text style={existenceStatus === option.key ? styles.chipActiveText : styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>項目名</Text>
        <TextInput
          onChangeText={setTitle}
          placeholder="保険証券、実印、年金証書など"
          placeholderTextColor="#8a958f"
          style={styles.input}
          value={title}
        />

        <Text style={styles.label}>保管場所メモ</Text>
        <TextInput
          multiline
          onChangeText={setLocation}
          placeholder="実家の茶色い棚、寝室の引き出しなど"
          placeholderTextColor="#8a958f"
          style={[styles.input, styles.multiline]}
          value={location}
        />

        <Text style={styles.label}>分かる人・連絡先メモ</Text>
        <TextInput
          multiline
          onChangeText={setOwnerNote}
          placeholder="長男が把握、保険代理店に確認など"
          placeholderTextColor="#8a958f"
          style={[styles.input, styles.multiline]}
          value={ownerNote}
        />

        <Pressable disabled={saving} style={[styles.button, saving ? styles.buttonDisabled : null]} onPress={save}>
          <Text style={styles.buttonText}>{saving ? "保存中" : "保存する"}</Text>
          <MaterialCommunityIcons color="#fff" name="content-save-outline" size={19} />
        </Pressable>
      </View>

      {message ? <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View> : null}

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons color={colors.green} name="folder-check-outline" size={22} />
          <Text style={styles.cardTitle}>登録済み</Text>
        </View>
        {items.length === 0 ? (
          <Text style={styles.body}>まだ登録はありません。まずは保険証券、実印、年金証書などから残してください。</Text>
        ) : null}
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.statusBadge}>{statusLabel(item.existence_status)}</Text>
            </View>
            <Text style={styles.itemMeta}>{item.asset_categories?.label ?? "未分類"}</Text>
            {item.location_note ? <Text style={styles.body}>場所: {item.location_note}</Text> : null}
            {item.owner_note ? <Text style={styles.body}>分かる人: {item.owner_note}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.paper, flex: 1 },
  screen: { gap: 14, padding: 18, paddingBottom: 32 },
  header: { gap: 6, paddingTop: 8 },
  kicker: { color: colors.green, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 37 },
  body: { color: colors.muted, lineHeight: 22 },
  warningBox: { alignItems: "flex-start", backgroundColor: "#fff9eb", borderColor: "#ead9b8", borderRadius: radius.card, borderWidth: 1, flexDirection: "row", gap: 10, padding: 13 },
  warningText: { color: "#6f532b", flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 11, padding: 16, ...shadow },
  cardTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  label: { color: colors.ink, fontWeight: "900" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  chipActiveText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  input: { backgroundColor: "#fff", borderColor: colors.line, borderRadius: radius.control, borderWidth: 1, color: colors.ink, minHeight: 46, padding: 12 },
  multiline: { minHeight: 78, textAlignVertical: "top" },
  button: { alignItems: "center", backgroundColor: colors.green, borderRadius: radius.control, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50 },
  buttonDisabled: { opacity: 0.62 },
  buttonText: { color: "#fff", fontWeight: "900" },
  notice: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, padding: 12 },
  noticeText: { color: colors.green, fontWeight: "900", lineHeight: 22 },
  itemRow: { backgroundColor: "#fbfdf9", borderColor: colors.line, borderRadius: radius.card, borderWidth: 1, gap: 5, padding: 12 },
  itemHeader: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  itemTitle: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900", lineHeight: 22 },
  itemMeta: { color: colors.green, fontSize: 12, fontWeight: "900" },
  statusBadge: { backgroundColor: colors.surfaceSoft, borderColor: colors.line, borderRadius: 999, borderWidth: 1, color: colors.greenDark, fontSize: 12, fontWeight: "900", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 }
});
