import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

/**
 * Reusable animated section wrapper with scroll-triggered animations
 * Provides fade-in, slide-up, and staggered children animations
 */
const AnimatedSection = ({
    children,
    className = '',
    animation = 'fadeUp', // 'fadeUp', 'fadeIn', 'slideLeft', 'slideRight', 'scale'
    delay = 0,
    duration = 0.6,
    threshold = 0.2,
    triggerOnce = true,
    stagger = 0.1,
    as = 'section',
    ...props
}) => {
    const { ref, inView } = useInView({
        threshold,
        triggerOnce,
    });

    // Animation variants
    const variants = {
        fadeUp: {
            hidden: { opacity: 0, y: 60 },
            visible: { opacity: 1, y: 0 },
        },
        fadeIn: {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
        },
        slideLeft: {
            hidden: { opacity: 0, x: -100 },
            visible: { opacity: 1, x: 0 },
        },
        slideRight: {
            hidden: { opacity: 0, x: 100 },
            visible: { opacity: 1, x: 0 },
        },
        scale: {
            hidden: { opacity: 0, scale: 0.8 },
            visible: { opacity: 1, scale: 1 },
        },
        blur: {
            hidden: { opacity: 0, filter: 'blur(10px)' },
            visible: { opacity: 1, filter: 'blur(0px)' },
        },
    };

    // Container variants for staggered children
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                delayChildren: delay,
                staggerChildren: stagger,
            },
        },
    };

    const MotionComponent = motion[as] || motion.section;

    return (
        <MotionComponent
            ref={ref}
            className={className}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={containerVariants}
            {...props}
        >
            {React.Children.map(children, (child, index) => {
                if (!React.isValidElement(child)) return child;

                return (
                    <motion.div
                        variants={variants[animation]}
                        transition={{
                            duration,
                            ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                    >
                        {child}
                    </motion.div>
                );
            })}
        </MotionComponent>
    );
};

/**
 * Single animated element (no stagger, used for individual items)
 */
export const AnimatedElement = ({
    children,
    className = '',
    animation = 'fadeUp',
    delay = 0,
    duration = 0.6,
    threshold = 0.2,
    triggerOnce = true,
    ...props
}) => {
    const { ref, inView } = useInView({
        threshold,
        triggerOnce,
    });

    const variants = {
        fadeUp: {
            hidden: { opacity: 0, y: 40 },
            visible: { opacity: 1, y: 0 },
        },
        fadeIn: {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
        },
        slideLeft: {
            hidden: { opacity: 0, x: -60 },
            visible: { opacity: 1, x: 0 },
        },
        slideRight: {
            hidden: { opacity: 0, x: 60 },
            visible: { opacity: 1, x: 0 },
        },
        scale: {
            hidden: { opacity: 0, scale: 0.9 },
            visible: { opacity: 1, scale: 1 },
        },
        blur: {
            hidden: { opacity: 0, filter: 'blur(8px)' },
            visible: { opacity: 1, filter: 'blur(0px)' },
        },
    };

    return (
        <motion.div
            ref={ref}
            className={className}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            variants={variants[animation]}
            transition={{
                duration,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94],
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export default AnimatedSection;
