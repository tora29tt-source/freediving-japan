/**
 * js/i18n.js — 固定UI文言の多言語辞書
 * 対象言語: en / ko / zh（日本語は各HTMLのデフォルト文言をそのまま使う）
 *
 * 使い方:
 *   <p class="section-title" data-i18n="section_bio">自己紹介</p>
 *   switchLang 内で I18N.apply(lang) を呼ぶ
 */

const I18N_DICT = {
  en: {
    /* --- 共通 --- */
    back_to_list:         'Find Instructors & Shops',
    lang_notice:          '(Translation coming soon)',
    empty_courses:        'No courses yet',
    empty_reviews:        'No reviews yet',
    website:              'Website',

    /* --- profile.html --- */
    type_instructor:      'Instructor',
    type_shop:            'Shop',
    stat_experience:      'Experience (yrs)',
    stat_plans:           'Plans',
    stat_certifications:  'Certifications',
    stat_courses:         'Courses',
    stat_instructors:     'Instructors',
    stat_rating:          'Rating',
    section_bio:          'About',
    section_certifications: 'Certifications',
    section_specialties:  'Specialties',
    section_areas:        'Area',
    section_links:        'Links',
    section_roster_shop:  'Our Instructors',
    section_roster_instructor: 'Affiliated Shops',
    section_courses:      'Courses',
    section_reviews:      'Reviews',

    /* --- listing.html --- */
    section_photos:       'Photos',
    label_duration:       'Duration',
    label_season:         'Season',
    label_target_level:   'Level',
    label_min_participants: 'Min. participants',
    label_max_participants: 'Max. participants',
    label_age:            'Age',
    label_shuttle:        'Shuttle',
    label_shuttle_yes:    'Available',
    label_booking_deadline: 'Booking deadline',
    section_includes:     "What's included",
    section_excludes:     "What's not included",
    section_bring:        'What to bring',
    section_cancel:       'Cancellation policy',
    section_gear:         'Rental gear',
    section_notes:        'Notes',
    section_detail:       'Course details',
    section_other:        'Other plans',
    btn_book:             'Book now',
    btn_inquiry:          'Inquiry',
    calendar_title:       'Availability',
    cancel_default:       '7+ days before: full refund (100%) / 3–6 days before: 50% refund / 2 days–day of: no refund (0%)',
    booking_form_name:    'Full name',
    booking_form_email:   'Email',
    booking_form_phone:   'Phone (optional)',
    booking_form_notes:   'Other requests',
    booking_form_submit:  'Confirm booking',
    booking_form_cancel:  'Cancel',
    full:                 'Full',
    remaining:            'remaining',
  },

  ko: {
    /* --- 공통 --- */
    back_to_list:         '강사 & 샵 찾기',
    lang_notice:          '(번역 준비 중)',
    empty_courses:        '등록된 코스가 없습니다',
    empty_reviews:        '아직 리뷰가 없습니다',
    website:              '웹사이트',

    /* --- profile.html --- */
    type_instructor:      '강사',
    type_shop:            '샵',
    stat_experience:      '경력 (년)',
    stat_plans:           '플랜 수',
    stat_certifications:  '자격',
    stat_courses:         '코스 수',
    stat_instructors:     '강사 수',
    stat_rating:          '평가',
    section_bio:          '소개',
    section_certifications: '자격',
    section_specialties:  '전문 분야',
    section_areas:        '활동 지역',
    section_links:        '링크',
    section_roster_shop:  '소속 강사',
    section_roster_instructor: '소속 샵',
    section_courses:      '코스 목록',
    section_reviews:      '리뷰',

    /* --- listing.html --- */
    section_photos:       '사진',
    label_duration:       '소요 시간',
    label_season:         '개최 시기',
    label_target_level:   '대상 레벨',
    label_min_participants: '최소 인원',
    label_max_participants: '최대 인원',
    label_age:            '참가 연령',
    label_shuttle:        '픽업',
    label_shuttle_yes:    '있음',
    label_booking_deadline: '예약 마감',
    section_includes:     '포함 사항',
    section_excludes:     '불포함 사항',
    section_bring:        '준비물',
    section_cancel:       '취소 정책',
    section_gear:         '렌탈 장비',
    section_notes:        '비고',
    section_detail:       '코스 상세',
    section_other:        '다른 플랜',
    btn_book:             '예약하기',
    btn_inquiry:          '문의하기',
    calendar_title:       '예약 가능 일정',
    cancel_default:       '7일 이상 전: 전액 환불 (100%) / 3~6일 전: 50% 환불 / 2일 전~당일: 환불 없음 (0%)',
    booking_form_name:    '이름',
    booking_form_email:   '이메일',
    booking_form_phone:   '전화번호 (선택)',
    booking_form_notes:   '기타 요청사항',
    booking_form_submit:  '예약 확인',
    booking_form_cancel:  '취소',
    full:                 '마감',
    remaining:            '남음',
  },

  zh: {
    /* --- 通用 --- */
    back_to_list:         '查找教练和店铺',
    lang_notice:          '（翻译准备中）',
    empty_courses:        '暂无课程',
    empty_reviews:        '暂无评价',
    website:              '官网',

    /* --- profile.html --- */
    type_instructor:      '教练',
    type_shop:            '店铺',
    stat_experience:      '经验 (年)',
    stat_plans:           '方案数',
    stat_certifications:  '证书',
    stat_courses:         '课程数',
    stat_instructors:     '教练数',
    stat_rating:          '评分',
    section_bio:          '简介',
    section_certifications: '证书',
    section_specialties:  '专业领域',
    section_areas:        '活动区域',
    section_links:        '链接',
    section_roster_shop:  '驻店教练',
    section_roster_instructor: '所属店铺',
    section_courses:      '课程列表',
    section_reviews:      '评价',

    /* --- listing.html --- */
    section_photos:       '照片',
    label_duration:       '所需时间',
    label_season:         '开放季节',
    label_target_level:   '适合水平',
    label_min_participants: '最少人数',
    label_max_participants: '最大人数',
    label_age:            '参加年龄',
    label_shuttle:        '接送',
    label_shuttle_yes:    '有',
    label_booking_deadline: '预约截止',
    section_includes:     '费用包含',
    section_excludes:     '费用不含',
    section_bring:        '需携带物品',
    section_cancel:       '取消政策',
    section_gear:         '租赁装备',
    section_notes:        '备注',
    section_detail:       '课程详情',
    section_other:        '其他方案',
    btn_book:             '立即预约',
    btn_inquiry:          '咨询',
    calendar_title:       '可用日期',
    cancel_default:       '7天以上前：全额退款 (100%) / 3~6天前：退款50% / 2天前~当天：不退款 (0%)',
    booking_form_name:    '姓名',
    booking_form_email:   '邮箱',
    booking_form_phone:   '电话（选填）',
    booking_form_notes:   '其他要求',
    booking_form_submit:  '确认预约',
    booking_form_cancel:  '取消',
    full:                 '满席',
    remaining:            '剩余',
  },
};

/**
 * applyI18n(lang)
 * data-i18n="キー" 属性を持つ要素のテキストを指定言語に切り替える。
 * ja の場合は HTML の元のテキストに戻す（data-i18n-ja に退避済みのものを復元）。
 */
window.I18N = {
  apply(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      // 初回: 日本語テキストを退避
      if (!el.dataset.i18nJa) el.dataset.i18nJa = el.textContent;
      if (lang === 'ja') {
        el.textContent = el.dataset.i18nJa;
      } else {
        const translated = I18N_DICT[lang]?.[key];
        el.textContent = translated || el.dataset.i18nJa;
      }
    });
  },
  t(lang, key, fallback) {
    if (lang === 'ja') return fallback || '';
    return I18N_DICT[lang]?.[key] || fallback || '';
  },
};
