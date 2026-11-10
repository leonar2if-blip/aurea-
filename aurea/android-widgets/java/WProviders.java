package com.leonar2if.aurea;

/** Un proveedor de widget por cada widget. Los complementarios arrancan desactivados y se habilitan solo cuando su módulo tiene datos. */
public final class WProviders {
    private WProviders() {}

    public static class MyDay extends WBase { String kind() { return "myday"; } }
    public static class Tasks extends WBase { String kind() { return "tasks"; } }
    public static class Habits extends WBase { String kind() { return "habits"; } }
    public static class Agenda extends WBase { String kind() { return "agenda"; } }
    public static class Focus extends WBase { String kind() { return "focus"; } }
    public static class Water extends WBase { String kind() { return "water"; } }
    public static class Capture extends WBase { String kind() { return "capture"; } }
    public static class Projects extends WBase { String kind() { return "projects"; } }
    public static class Goals extends WBase { String kind() { return "goals"; } }
    public static class Money extends WBase { String kind() { return "money"; } }
    public static class Diary extends WBase { String kind() { return "diary"; } }
    public static class Stats extends WBase { String kind() { return "stats"; } }

    static final String[] KINDS = {"myday", "tasks", "habits", "agenda", "focus", "water", "capture", "projects", "goals", "money", "diary", "stats"};

    @SuppressWarnings("unchecked")
    static final Class<? extends WBase>[] CLASSES = new Class[]{MyDay.class, Tasks.class, Habits.class, Agenda.class, Focus.class, Water.class,
            Capture.class, Projects.class, Goals.class, Money.class, Diary.class, Stats.class};

    /** Widgets complementarios (opcionales): solo aparecen en el selector si su módulo tiene datos reales. */
    static final String[] OPTIONAL = {"projects", "goals", "money", "diary", "stats"};

    static Class<? extends WBase> classOf(String kind) {
        for (int i = 0; i < KINDS.length; i++) if (KINDS[i].equals(kind)) return CLASSES[i];
        return null;
    }
}
