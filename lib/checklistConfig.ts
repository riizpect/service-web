export type ProductType = "VIPER" | "VLS" | "VIPER_VLS";

export type ChecklistStatus = "OK" | "ATGÄRDAD" | "AVVIKELSE" | "EJ_KONTROLLERAD";

export interface ChecklistItemConfig {
  key: string;
  label: string;
}

export interface ChecklistSectionConfig {
  key: string;
  title: string;
  items: ChecklistItemConfig[];
}

export interface ProductChecklistConfig {
  productType: ProductType;
  sections: ChecklistSectionConfig[];
}

export const VIPER_CHECKLIST: ProductChecklistConfig = {
  productType: "VIPER",
  sections: [
    {
      key: "viper_funktionstest_fore_service",
      title: "Funktionstest före service",
      items: [
        { key: "hoj_sank", label: "Höj- och sänkfunktion fungerar i hela rörelseområdet" },
        { key: "lasta_vls", label: "Båren går att lasta i VLS korrekt" },
        { key: "laser_vls", label: "Båren låser korrekt i VLS" },
        { key: "lossa_vls", label: "Båren går att lossa korrekt från VLS" },
        { key: "laddar_vls", label: "Båren laddar i VLS" },
        { key: "unload_position", label: "Unload-position fungerar korrekt" }
      ]
    },
    {
      key: "viper_ram_struktur",
      title: "Ram och struktur",
      items: [
        { key: "ram_rails", label: "Ram och rails fria från sprickor eller skador" },
        { key: "guidehjul", label: "Guidehjul och rullar snurrar fritt" },
        { key: "plastpluggar", label: "Plastpluggar sitter korrekt" },
        { key: "silent_blocks", label: "Silent blocks hela" }
      ]
    },
    {
      key: "viper_lasning_front",
      title: "Låsning och front",
      items: [
        { key: "front_lock", label: "Front lock fungerar korrekt" },
        { key: "plunger_switch_skick", label: "Plunger switch i gott skick" },
        { key: "lasning_vls", label: "Låsning testad i VLS" }
      ]
    },
    {
      key: "viper_hjul_bromsar",
      title: "Hjul och bromsar",
      items: [
        { key: "hjul_snurrar", label: "Hjul snurrar fritt" },
        { key: "hjul_glapp", label: "Inget glapp i hjul" },
        { key: "sprickor_flatspots", label: "Inga sprickor eller flat spots" },
        { key: "bromsar", label: "Bromsar fungerar korrekt" },
        { key: "riktningslas", label: "Riktningslås fungerar" }
      ]
    },
    {
      key: "viper_rorliga_delar",
      title: "Rörliga delar",
      items: [
        { key: "ryggstod", label: "Ryggstöd rör sig korrekt" },
        { key: "shock_frame", label: "Shock frame rör sig fritt" },
        { key: "telescoping_frame", label: "Telescoping frame fungerar smidigt" }
      ]
    },
    {
      key: "viper_gasfjadrar",
      title: "Gasfjädrar",
      items: [
        { key: "gas_oljelackage", label: "Inget oljeläckage" },
        { key: "gas_kraft", label: "Normal kraft och funktion" }
      ]
    },
    {
      key: "viper_hydraulik",
      title: "Hydraulik",
      items: [
        { key: "hyd_hojer_sanker", label: "Höjer och sänker i hela rörelsen" },
        { key: "hyd_oljelackage", label: "Inga oljeläckage" },
        { key: "hyd_missljud", label: "Inga missljud" }
      ]
    },
    {
      key: "viper_elektriskt",
      title: "Elektriskt system",
      items: [
        { key: "laddkontakter", label: "Laddkontakter i gott skick" },
        { key: "laddning_fordon", label: "Laddning från fordon fungerar" },
        { key: "laddning_extern", label: "Laddning med extern laddare fungerar" },
        { key: "induktiv_sensor", label: "Induktiv sensor fungerar" },
        { key: "plunger_unload", label: "Plunger switch fungerar korrekt vid unload" },
        {
          key: "kabeldragning",
          label: "Kabeldragning mellan kabeltunnel och elbox i gott skick"
        }
      ]
    },
    {
      key: "viper_manuell_nodsankning",
      title: "Manuell nödsänkning",
      items: [
        { key: "override_handtag", label: "Manual override-handtag i gott skick" },
        { key: "nod_kabel", label: "Kabel i gott skick" },
        { key: "nodfunktion", label: "Nödsänkningsfunktion testad" }
      ]
    },
    {
      key: "viper_mjukvara_app",
      title: "Mjukvara och app",
      items: [
        { key: "mu_fw", label: "MU firmware kontrollerad" },
        { key: "bms_fw", label: "BMS firmware kontrollerad" },
        { key: "hogsta_position", label: "Högsta position kontrollerad" },
        { key: "loading_position", label: "Loading position kontrollerad" },
        { key: "lagsta_position", label: "Lägsta position kontrollerad" },
        {
          key: "serviceapp_installningar",
          label: "Rekommenderade inställningar i serviceapp kontrollerade"
        },
        { key: "servicerapport_app", label: "Servicerapport genererad i app" }
      ]
    }
  ]
};

export const VLS_CHECKLIST: ProductChecklistConfig = {
  productType: "VLS",
  sections: [
    {
      key: "vls_slider",
      title: "Slider",
      items: [
        { key: "slider_rorelse", label: "Slider rör sig fritt i båda riktningar" },
        { key: "slider_glapp", label: "Slider utan överdrivet glapp" },
        { key: "guideytor", label: "Guideytor i gott skick" },
        { key: "release_levers", label: "Release levers fungerar korrekt" },
        { key: "rullar", label: "Rullar i gott skick" },
        {
          key: "hyd_stotdampare",
          label: "Hydraulisk stötdämpare fungerar korrekt"
        }
      ]
    },
    {
      key: "vls_loading_arm",
      title: "Loading arm",
      items: [
        { key: "la_rullar", label: "Rullar snurrar fritt" },
        { key: "kontrollhandtag", label: "Kontrollhandtag fungerar korrekt" },
        { key: "swing_brace", label: "Swing brace fungerar korrekt" },
        { key: "swing_brace_lasning", label: "Swing brace-låsning fungerar korrekt" },
        { key: "sidokapor", label: "Sidokåpor i gott skick" },
        { key: "la_laser", label: "Loading arm låser korrekt" },
        { key: "pins_las", label: "Pins-låsmekanism fungerar korrekt" },
        {
          key: "pulley_supports",
          label: "Pulley supports och pulleys sitter korrekt"
        }
      ]
    },
    {
      key: "vls_linear_guiding",
      title: "Linear guiding",
      items: [
        {
          key: "lg_rengjorda",
          label: "Linear guides rengjorda och kontrollerade"
        },
        { key: "lg_rorelse", label: "Linear guides rör sig fritt" },
        { key: "lg_caps", label: "Caps finns på plats" },
        {
          key: "blue_magnetic",
          label: "Blue magnetic stoppers i gott skick"
        }
      ]
    },
    {
      key: "vls_fixation",
      title: "Fixation",
      items: [
        {
          key: "framre_laspinnar",
          label: "Främre låspinnar fungerar korrekt"
        },
        { key: "bakre_laspinne", label: "Bakre låspinne fungerar korrekt" },
        { key: "rod", label: "Rod i gott skick" },
        {
          key: "protection_rail",
          label: "Protection rail finns på plats"
        },
        {
          key: "charging_connectors",
          label: "Charging connectors rena och i gott skick"
        },
        {
          key: "pulley_skruvar",
          label: "Skruvar och rullar på pulleys i gott skick"
        },
        { key: "locking_springs", label: "Locking springs i gott skick" }
      ]
    },
    {
      key: "vls_funktion_med_bar",
      title: "Funktion med bår",
      items: [
        {
          key: "bar_rullas_slider",
          label: "Båren kan rullas upp på slider korrekt"
        },
        {
          key: "slider_laser",
          label: "Slider låser upp och rör sig fritt på loading arm"
        },
        {
          key: "swing_brace_funktion",
          label: "Swing brace frigörs, lyfts och låser korrekt"
        },
        {
          key: "la_laser_upp",
          label: "Loading arm låser upp korrekt när benen är fullt indragna"
        },
        { key: "bar_laser_vls", label: "Båren låser korrekt i VLS" },
        {
          key: "spel_rear_fixing",
          label: "Korrekt spel bakom rear fixing pin"
        },
        {
          key: "lastas_hogsta_position",
          label: "Båren kan lastas i högsta position inom korrekt område"
        },
        {
          key: "etiketter",
          label: "Säkerhets- och instruktionsetiketter i gott skick"
        }
      ]
    },
    {
      key: "vls_infastning_hardvara",
      title: "Infästning och hårdvara",
      items: [
        {
          key: "skruvar_muttrar",
          label: "Skruvar och muttrar kontrollerade"
        },
        { key: "saknade_delar", label: "Inga saknade delar" },
        {
          key: "glapp_infastning",
          label: "Ingen onormal glapphet i infästning"
        }
      ]
    }
  ]
};

export function getChecklistForProductType(
  productType: ProductType
): ChecklistSectionConfig[] {
  if (productType === "VIPER") return VIPER_CHECKLIST.sections;
  if (productType === "VLS") return VLS_CHECKLIST.sections;
  return [...VIPER_CHECKLIST.sections, ...VLS_CHECKLIST.sections];
}

