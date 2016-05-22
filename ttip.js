/**
 * This small library allows to add tooltips to page elements.
 * @author Alex O. <organ.f.a@gmail.com>
 */

/* global jQuery */

(function ($, ttip) {

    /**
     * Debounce function calls
     *
     * @param {Function} fn
     * @param {Number} delay Timeout delay in milliseconds
     */
    function debounce(fn, delay) {
        var timer = null;
        return function () {
            var context = this, args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () {
                fn.apply(context, args);
            }, delay);
        };
    }


    // Debug parameters
    var DEBUG = false;

    /**
     * Pring rebug message if debugging enabled
     * @param {String} message
     */
    function debug(message) {
        if (DEBUG) console.log(message);
    }

    /**
     * Bounding box class
     * @param {HTMLElement} element
     * @return {object} Element dimensions
     * @constructor
     */
    function BBox(element) {
        // todo : by changing body to offset parent we can use any element as container
        var body = document.getElementsByTagName('body')[0]
            , W = body.offsetWidth
            , H = body.offsetHeight
            , bb = element.getBoundingClientRect()
            ;

        /**
         * Element dimensions object
         * @attr {int} top Available space to the top
         * @attr {int} bottom Available space to the bottom
         * @attr {int} right Available space to the right
         * @attr {int} left Available space to the left
         * @attr {object} center Coordinates of cenver of tooltipped element
         */
        var D = {
            get top() {
                return bb.top;
            },
            get left() {
                return bb.left;
            },
            get right() {
                return W
                    - this.left
                    - bb.width
                    ;
            },
            get bottom() {
                return H
                    - this.top
                    - bb.height
                    ;
            },
            center: {
                get x() {
                    return D.left + bb.width / 2;
                },
                get y() {
                    return D.top + bb.height / 2;
                }
            },
            h: bb.height,
            w: bb.width
        };
        return D;
    }

    /**
     * Base class for tooltips and popovers. Tooltip and popover elements add new div element inside
     * target. This div element will be shown when ucrsor is over tooltip target.
     *
     * @constructor
     * @memberOf ttip
     * @param {jQuery} target
     * @param {string} type
     * @type {HTMLDivElement} this.target
     */
    function BaseTooltip(target, type) {
        this.$target = target;
        this.target = this.$target.get(0);
        this.type = type;
        this.PADDING = 10;
        this.POSITIONS = [this.TOP, this.BOTTOM, this.RIGHT, this.LEFT];

        this.bbox = new BBox(this.target);
        this.container = this.addContainer();
        setTimeout(function () {
            this.render();
        }.bind(this), 0);
    }

    /**
     * Add tooltip container (div element) to target
     *
     * @function
     * @memberOf BaseTooltip
     */
    BaseTooltip.prototype.addContainer = function () {
        var before = $('<div/>').addClass('before')
            , after = $('<div/>').addClass('after')
            , containerWidth = 250
            , pos = this.getPosition()
            , minWidth = 50
            , avail = this.bbox[pos]
            ;
        if (pos == this.LEFT || pos == this.RIGHT) {
            if (avail < minWidth) {
                containerWidth = minWidth;
            } else if (avail < containerWidth) {
                containerWidth = avail - this.PADDING * 2;
            }
        }
        this.pin = before.add(after);
        this.container = $('<div/>')
            .css({
                visibility: 'hidden',
                opacity: 0
            })
            .addClass('ttip-container')
            .appendTo(this.$target)
            .width(containerWidth)
            .append(before)
            .append(after)
        ;
        var contentEl = $('<div/>')
            .addClass('ttip-content')
            .appendTo(this.container)
            ;
        this.setContent(contentEl);
        this.container.width(contentEl.width() + this.PADDING * 2);
        setTimeout(function () {
            this.container.css({
                visibility: '',
                opacity: ''
            });
        }.bind(this), 0);
        return this.container;
    };

    /**
     * Get available space to each side of the tooltip target
     *
     * @function
     * @memberOf BaseTooltip
     * @return {Array<Number>} Array of available space to the top, bottom,
     *      right, left
     */
    BaseTooltip.prototype.getAvail = function () {
        return this.POSITIONS.map(function (p) {
            return this.bbox[p];
        }.bind(this));
    };


    /**
     * Calculate ttip position from `data-ttip-position` or where's most available space
     *
     * @returns {string} Calculated position
     */
    BaseTooltip.prototype.getPosition = function () {
        var positions = [this.TOP, this.BOTTOM, this.RIGHT, this.LEFT]
            , attr = this.target.getAttribute('data-ttip-position')
            ;
        if (attr) {
            if (positions.indexOf(attr) != -1) {
                return attr;
            } else {
                throw Error("Incorrect value of \"ttip-position\" attr: " + attr);
            }
        } else {
            var avail = this.getAvail();
            var maxAvail = Math.max.apply(null, avail);
            return positions[avail.indexOf(maxAvail)];
        }
    };

    /**
     * Remove tooltip container from element
     * @memberOf BaseTooltip
     */
    BaseTooltip.prototype.reset = function () {
        $('.ttip-container').remove();
    };


    /**
     * Set container position
     * @memberOf BaseTooltip
     */
    BaseTooltip.prototype.render = function () {
        var $c = this.container instanceof $ ? this.container : $(this.container)
            , c = $c.get(0)
            , shiftx = (this.bbox.w - c.offsetWidth) / 2
            , shifty = (this.bbox.h - c.offsetHeight) / 2
            , position = this.getPosition()
            , minpad = 5
            , pinshift
            ;
        debug('Container shift x: ' + this.bbox.w + ' - ' + c.offsetWidth + ' / 2 = ' + shiftx);
        debug('Container shift y: ' + this.bbox.h + ' - ' + c.offsetHeight + ' / 2 = ' + shifty);
        switch (position) {
            case this.TOP:
                shifty = -(c.offsetHeight + this.PADDING);
                break;
            case this.BOTTOM:
                shifty = this.bbox.h + this.PADDING;
                break;
            case this.RIGHT:
                shiftx = this.bbox.w + this.PADDING;
                break;
            case this.LEFT:
                shiftx = -(c.offsetWidth + this.PADDING);
                break;
            default:
                throw Error("Unknown position: " + position);
        }

        // Element position correction to fit in on the page
        if (position == this.TOP || position == this.BOTTOM) {
            // Horizontal correction
            var c = this.container instanceof $ ? this.container.get(0) : this.container;
            var fitsLeft = (this.bbox.w / 2 + this.bbox.left + minpad * 2) > c.offsetWidth / 2;
            var fitsRight = (this.bbox.w / 2 + this.bbox.right + minpad * 2) > c.offsetWidth / 2;
            if (!(fitsLeft && fitsRight) && (fitsLeft || fitsRight)) {
                if (!fitsLeft) {
                    shiftx = minpad - this.bbox.left;
                    pinshift = this.bbox.center.x - minpad;
                    this.pin.css('left', pinshift);
                } else if (!fitsRight) {
                    shiftx = this.bbox.right - minpad + this.bbox.w - c.offsetWidth;
                    pinshift = this.bbox.w / 2 + this.bbox.right - minpad - 10;
                    this.pin.css('right', pinshift).css('left', 'initial');
                }
            }
        } else {
            var fitsTop = (this.bbox.h / 2 + this.bbox.top + minpad * 2) > c.offsetHeight / 2;
            var fitsBottom = (this.bbox.h / 2 + this.bbox.bottom + minpad * 2) > c.offsetHeight / 2;
            // Verticall correction
            if (!(fitsTop && fitsBottom) && (fitsTop || fitsBottom)){
                if (!fitsBottom) {
                    minpad = Math.min(minpad, this.bbox.bottom);
                    shifty = this.bbox.bottom - minpad + this.bbox.h - c.offsetHeight;
                    pinshift = this.bbox.h / 2 + this.bbox.bottom - minpad - 10;
                    this.pin.css('bottom', pinshift).css('top', 'initial');
                } else if (!fitsTop) {
                    minpad = Math.min(minpad, this.bbox.top);
                    shifty = minpad - this.bbox.top;
                    pinshift = this.bbox.center.y - minpad;
                    this.pin.css('top', pinshift);
                }
            }
        }

        $c.addClass(position).css('top', shifty).css('left', shiftx);
        return this.container;
    };

    // Helper properties

    BaseTooltip.prototype.TOOLTIP = 'tooltip';
    BaseTooltip.prototype.POPOVER = 'popover';
    BaseTooltip.prototype.TOP = 'top';
    BaseTooltip.prototype.BOTTOM = 'bottom';
    BaseTooltip.prototype.RIGHT = 'right';
    BaseTooltip.prototype.LEFT = 'left';


    /**
     * Tooltip class
     *
     * @constructor
     * @extends BaseTooltip
     * @param {jQuery} target Target element
     */
    function Tooltip(target) {
        this.base = BaseTooltip;
        this.base(target, this.TOOLTIP);
    }

    Tooltip.prototype = Object.create(BaseTooltip.prototype);

    /**
     * Add content to ttip container element from tooltip target attribute
     *
     * @function
     * @memberOf Tooltip
     * @param {jQuery} container
     */
    Tooltip.prototype.setContent = function (container) {
        var text = this.$target.attr('data-tooltip');
        debug("Add tooltip text content: " + text.length + ' characters.');
        container.text(text);
    };

    /**
     * Popover class
     *
     * @constructor
     * @extends BaseTooltip
     * @param {jQuery} target Target element
     */
    function Popover(target) {
        this.base = BaseTooltip;
        this.base(target, this.POPOVER);
    }

    Popover.prototype = Object.create(BaseTooltip.prototype);

    /**
     * Add content to ttip container element by id of html element which will be used as template
     *
     * @function
     * @memberOf Tooltip
     * @param {jQuery} container
     */
    Popover.prototype.setContent = function (container) {
        var content = this.$target.attr('data-popover');
        debug("Add popover content from " + content);
        container.html($('[data-popover-content=' + content + ']').html());
    };

    $(document).on('ready', function () {

        // Create and show tooltip element
        $(document).on('mouseenter', '[data-tooltip]', function (e) {
            var target = e.target
                , $target = $(target)
                ;
            if (!$target.has('.ttip-container').length) {
                new Tooltip($target);
            }
        });

        // Create and show popover element
        $(document).on('mouseenter', '[data-popover]', function (e) {
            var target = e.target
                , $target = $(target)
                ;
            if (!$target.has('.ttip-container').length && $target.is('[data-popover]')) {
                new Popover($target);
            }
        });

        // Toggle popover open
        $(document).on('click', '[data-popover].toggle', function (e) {
            var $t = $(e.target);
            if ($t.hasClass('open')) {
                $t.removeClass('open');
            } else {
                $t.addClass('open');
            }
        });

        $(document).on('dblclick', '[data-popover].toggle', function(e){
            e.preventDefault();
            e.stopPropagation();
        });

    });


    /**
     * Tooltips namespace.
     * @namespace
     */
    ttip = {
        Tooltip: Tooltip,
        Popover: Popover
    };

    $(window).resize(debounce(function (e) {
        BaseTooltip.prototype.reset();
    }, 200));

})(jQuery, window.ttip);