-- Task template seed for 親のもしもナビ v0.3
-- Run after supabase/schema.sql.

insert into task_templates (status, title, description, default_due_offset_days, priority, category, requires_professional) values
('preparing', '家族で連絡先と役割を確認する', '親本人、兄弟姉妹、近い親族の連絡先と、緊急時に動く人を決めます。', 7, 2, 'family', false),
('preparing', '重要書類の存在と保管場所を聞く', '通帳、保険証券、年金、実印、権利書などの有無と場所だけを記録します。', 14, 2, 'registry', false),
('hospitalized', '病院の窓口と退院見込みを確認する', '主治医、医療相談員、退院支援窓口、必要書類を整理します。', 3, 1, 'medical', false),
('hospitalized', '支払いと保険請求に必要な書類を集める', '限度額適用認定証、診断書、保険証券の保管場所を確認します。', 7, 2, 'money', false),
('facility', '施設契約と費用負担を家族で確認する', '月額費用、退去条件、身元引受人、緊急連絡先を整理します。', 7, 1, 'care', false),
('cognitive_decline', '判断能力低下時の相談先を確認する', '地域包括支援センター、ケアマネ、成年後見等の相談先候補を控えます。法的判断は専門家に確認します。', 7, 1, 'professional', true),
('end_of_life', '緊急連絡先と看取り方針を共有する', '病院・施設・家族間で、連絡順と希望を事実ベースで共有します。', 1, 1, 'urgent', false),
('after_death', '死亡診断書と葬儀社連絡を確認する', '死亡診断書、搬送先、葬儀社、親族連絡の担当を整理します。', 1, 1, 'funeral', false),
('after_funeral', '公的手続きの期限を確認する', '年金、健康保険、介護保険、世帯主変更など、自治体で必要な手続きを確認します。', 7, 1, 'public', false),
('inheritance', '相続人と財産の一覧を作る', '相続人、預貯金、不動産、保険、負債の存在を一覧化します。判断は専門家に相談します。', 14, 1, 'inheritance', true),
('home_clearance', '実家カルテを作る', '鍵、ライフライン、空き家状況、家財量、写真を登録します。', 7, 1, 'home', false),
('home_clearance', '家財整理・空き家管理の相談条件を整理する', '許認可、保険、追加費用、見積明細を確認する前提で候補を比較します。', 14, 2, 'provider', false);
